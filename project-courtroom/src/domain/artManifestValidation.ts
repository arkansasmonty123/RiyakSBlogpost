/**
 * Deterministic, offline validation of art-asset manifests for the Phase 5 art pipeline
 * (D-002 visual style, D-012 asset rights, D-018 content/asset licence).
 *
 * This module never downloads, imports or approves anything. It only checks that the metadata
 * a human must supply is present and well formed, so a template or a half-finished draft can
 * never be mistaken for an approved, rights-cleared asset pack. A `status: "approved"` asset
 * additionally requires explicit licence/source/author/reviewer/checksum provenance, and the
 * validator warns when size budgets are exceeded — it still cannot confirm that a reviewer
 * actually checked a licence; that remains a human act.
 *
 * See docs/art-pipeline/README.md for the folder layout, naming rules and approval workflow.
 */

export type ArtValidationSeverity = 'error' | 'warning';

export interface ArtValidationIssue {
  /** Stable machine-readable code, suitable for CI output and tests. */
  code: string;
  /** Clear, actionable explanation. */
  message: string;
  field?: string;
  severity: ArtValidationSeverity;
}

export interface ArtValidationResult {
  ok: boolean;
  errors: ArtValidationIssue[];
  warnings: ArtValidationIssue[];
}

export interface ArtValidationOptions {
  /** Soft per-asset size warning threshold, in bytes. Defaults to 1 MiB. */
  perAssetBudgetBytes?: number;
  /** Soft total-manifest size warning threshold, in bytes. Defaults to 5 MiB. */
  totalBudgetBytes?: number;
}

export const ART_MANIFEST_SCHEMA_VERSION = 1;
export const ART_MANIFEST_STATUSES = ['blocked', 'draft', 'in-review', 'approved'] as const;
export const ART_ASSET_KINDS = ['viewpoint', 'portrait', 'prop', 'ui-icon', 'texture', 'sound', 'font'] as const;
export const ART_ASSET_STATUSES = ['draft', 'approved', 'rejected'] as const;
export const ART_ASSET_ORIGINS = ['original', 'licensed-third-party', 'ai-generated'] as const;
/** Only optimised vector/WebP/PNG outputs are allowed into the pack (README section 5). */
export const ART_ASSET_EXTENSIONS = ['svg', 'webp', 'png'] as const;

/** Soft budgets (bytes): warnings only, never hard failures. Keeps Cloud Shell /home lean (D-019). */
export const DEFAULT_PER_ASSET_BUDGET_BYTES = 1_048_576; // 1 MiB
export const DEFAULT_TOTAL_BUDGET_BYTES = 5_242_880; // 5 MiB

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/i;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value.trim());
}

function isSha256(value: string): boolean {
  return SHA256.test(value.trim());
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Reject absolute paths, Windows drive paths, backslashes and dot segments in asset paths. */
function isSafeRelativePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('\\') || /^[a-zA-Z]:/.test(trimmed)) return false;
  return !trimmed.split('/').some((segment) => segment === '..' || segment === '.');
}

function issue(
  code: string,
  message: string,
  field?: string,
  severity: ArtValidationSeverity = 'error',
): ArtValidationIssue {
  return field ? { code, message, field, severity } : { code, message, severity };
}

/** Validate a single art-asset record. Accepts unknown input so untrusted manifest JSON is safe. */
export function validateArtAsset(asset: unknown, options: ArtValidationOptions = {}): ArtValidationResult {
  const errors: ArtValidationIssue[] = [];
  const warnings: ArtValidationIssue[] = [];

  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    return {
      ok: false,
      errors: [issue('INVALID_ASSET', 'Each asset must be a JSON object with provenance fields.')],
      warnings,
    };
  }

  const record = asset as Record<string, unknown>;

  // --- Core shape, required for every status (draft / approved / rejected) -----------------
  for (const [field, code, message] of [
    ['id', 'MISSING_ID', 'A stable asset id is required.'],
    ['file', 'MISSING_FILE', 'A relative file path beneath the art intake folder is required.'],
  ] as const) {
    if (!hasText(record[field])) errors.push(issue(code, message, field));
  }

  const kind = record.kind;
  if (!hasText(kind)) {
    errors.push(issue('MISSING_KIND', 'An asset kind is required.', 'kind'));
  } else if (!(ART_ASSET_KINDS as readonly string[]).includes(kind)) {
    errors.push(issue('INVALID_KIND', `Kind must be one of: ${ART_ASSET_KINDS.join(', ')}.`, 'kind'));
  }

  const status = record.status;
  if (!hasText(status)) {
    errors.push(issue('MISSING_STATUS', 'An asset status is required.', 'status'));
  } else if (!(ART_ASSET_STATUSES as readonly string[]).includes(status)) {
    errors.push(issue('INVALID_STATUS', `Status must be one of: ${ART_ASSET_STATUSES.join(', ')}.`, 'status'));
  }

  const file = record.file;
  if (hasText(file) && !isSafeRelativePath(file)) {
    errors.push(
      issue('UNSAFE_ASSET_PATH', 'File must be a relative path with no absolute prefix or ".." segments.', 'file'),
    );
  }
  if (hasText(file) && isSafeRelativePath(file)) {
    const extension = file.trim().split('.').pop()?.toLowerCase() ?? '';
    if (!(ART_ASSET_EXTENSIONS as readonly string[]).includes(extension)) {
      errors.push(
        issue(
          'UNSUPPORTED_ASSET_EXTENSION',
          `Asset file must use an approved optimised format: ${ART_ASSET_EXTENSIONS.join(', ')}.`,
          'file',
        ),
      );
    }
  }

  const origin = record.origin;
  if (hasText(origin) && !(ART_ASSET_ORIGINS as readonly string[]).includes(origin)) {
    errors.push(issue('INVALID_ORIGIN', `Origin must be one of: ${ART_ASSET_ORIGINS.join(', ')}.`, 'origin'));
  }

  for (const [field, code] of [
    ['createdDate', 'INVALID_CREATED_DATE'],
    ['approvedDate', 'INVALID_APPROVED_DATE'],
  ] as const) {
    const value = record[field];
    if (value !== undefined && value !== '' && (!hasText(value) || !isIsoDate(value))) {
      errors.push(issue(code, `${field} must use YYYY-MM-DD format.`, field));
    }
  }

  if (record.sizeBytes !== undefined && !isNonNegativeInt(record.sizeBytes)) {
    errors.push(issue('INVALID_SIZE', 'sizeBytes must be a non-negative integer number.', 'sizeBytes'));
  }

  if (record.checksum !== undefined && record.checksum !== '') {
    if (!hasText(record.checksum) || !isSha256(record.checksum)) {
      errors.push(
        issue('INVALID_CHECKSUM', 'checksum must be "sha256:<64 lowercase/uppercase hex digits>".', 'checksum'),
      );
    }
  }

  // --- Approval gate: an approved asset carries full, human-attested provenance ------------
  const isApproved = status === 'approved';
  if (!isApproved) {
    // Drafts and rejected assets may be incomplete; nudge intake without blocking it.
    if (!hasText(record.origin)) {
      warnings.push(
        issue('ORIGIN_UNDECLARED', 'Origin is not declared yet (original / third-party / AI).', 'origin', 'warning'),
      );
    }
    if (!hasText(record.license)) {
      warnings.push(issue('LICENSE_UNDECLARED', 'No license recorded yet.', 'license', 'warning'));
    }
    if (!hasText(record.source)) {
      warnings.push(issue('SOURCE_UNDECLARED', 'No source/provenance note recorded yet.', 'source', 'warning'));
    }
  } else {
    if (!hasText(record.license)) {
      errors.push(
        issue(
          'APPROVED_MISSING_LICENSE',
          'An approved asset must name its license (or "Original - author-owned"). Never leave it blank.',
          'license',
        ),
      );
    }
    if (!hasText(record.source)) {
      errors.push(
        issue(
          'APPROVED_MISSING_SOURCE',
          'An approved asset must record a traceable source/provenance note (where/how it was obtained).',
          'source',
        ),
      );
    }
    if (!hasText(record.author)) {
      errors.push(issue('APPROVED_MISSING_AUTHOR', 'An approved asset must name its author.', 'author'));
    }
    if (!hasText(record.origin)) {
      errors.push(issue('APPROVED_MISSING_ORIGIN', 'An approved asset must declare its origin.', 'origin'));
    }
    if (!hasText(record.createdDate)) {
      errors.push(
        issue('APPROVED_MISSING_CREATED_DATE', 'An approved asset must record when it was created.', 'createdDate'),
      );
    }
    if (!hasText(record.approvedDate)) {
      errors.push(issue('APPROVED_MISSING_DATE', 'An approved asset must record its approval date.', 'approvedDate'));
    }
    if (!hasText(record.approvedBy)) {
      errors.push(
        issue(
          'APPROVED_WITHOUT_REVIEWER',
          'An approved asset must name the human reviewer who signed it off.',
          'approvedBy',
        ),
      );
    }
    if (!hasText(record.checksum)) {
      errors.push(
        issue(
          'APPROVED_MISSING_CHECKSUM',
          'An approved asset must record a sha256 checksum of the committed file.',
          'checksum',
        ),
      );
    }
    if (record.sizeBytes === undefined) {
      errors.push(issue('APPROVED_MISSING_SIZE', 'An approved asset must record its sizeBytes.', 'sizeBytes'));
    }
    if (origin === 'ai-generated' && !hasText(record.rightsNote)) {
      warnings.push(
        issue(
          'AI_RIGHTS_UNCONFIRMED',
          'Generative output: record a rightsNote confirming the output rights were reviewed (D-012).',
          'rightsNote',
          'warning',
        ),
      );
    }
    if (!hasText(record.usedAt)) {
      warnings.push(
        issue(
          'NO_USAGE_LOCATION',
          'Record usedAt (where in the game the asset appears) for traceability.',
          'usedAt',
          'warning',
        ),
      );
    }
  }

  // --- Soft size budget --------------------------------------------------------------------
  const perAssetBudget = isPositiveInt(options.perAssetBudgetBytes)
    ? options.perAssetBudgetBytes
    : DEFAULT_PER_ASSET_BUDGET_BYTES;
  if (isNonNegativeInt(record.sizeBytes) && record.sizeBytes > perAssetBudget) {
    warnings.push(
      issue(
        'ASSET_OVER_SIZE_BUDGET',
        `sizeBytes (${record.sizeBytes}) exceeds the ${perAssetBudget}-byte per-asset soft budget; optimise or split the asset.`,
        'sizeBytes',
        'warning',
      ),
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

export interface ArtBatchAssetResult extends ArtValidationResult {
  index: number;
  id?: string;
}

export interface ArtBatchValidationResult {
  ok: boolean;
  total: number;
  invalid: number;
  results: ArtBatchAssetResult[];
}

/** Validate a batch of asset records, preserving their positions for clear CLI reporting. */
export function validateArtAssets(input: unknown, options: ArtValidationOptions = {}): ArtBatchValidationResult {
  const records: unknown[] = Array.isArray(input) ? input : input === undefined ? [] : [input];
  const results: ArtBatchAssetResult[] = records.map((record, index) => {
    const result = validateArtAsset(record, options);
    const rawId =
      record && typeof record === 'object' && !Array.isArray(record)
        ? (record as Record<string, unknown>).id
        : undefined;
    return {
      index,
      ...(hasText(rawId) ? { id: rawId } : {}),
      ...result,
    };
  });
  return {
    ok: results.every((result) => result.ok),
    total: results.length,
    invalid: results.filter((result) => !result.ok).length,
    results,
  };
}

export interface ArtManifestResult {
  ok: boolean;
  errors: ArtValidationIssue[];
  warnings: ArtValidationIssue[];
  assets?: ArtBatchValidationResult;
  schemaVersion?: number;
  status?: string;
  totalSizeBytes?: number;
}

/**
 * Validate a whole art-asset manifest in one deterministic pass. Rejects anything explicitly
 * marked as a template so a shape/example file can never be mistaken for an approved pack.
 */
export function validateArtManifest(input: unknown, options: ArtValidationOptions = {}): ArtManifestResult {
  const errors: ArtValidationIssue[] = [];
  const warnings: ArtValidationIssue[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      errors: [issue('INVALID_MANIFEST', 'An art manifest must be a JSON object (see docs/art-pipeline/README.md).')],
      warnings,
    };
  }

  const manifest = input as Record<string, unknown>;

  if (manifest.template) {
    errors.push(
      issue(
        'MANIFEST_IS_TEMPLATE',
        'This is a TEMPLATE, not an approved asset manifest. Never ingest a template; create a real manifest only through the human review workflow in docs/art-pipeline/README.md.',
        'template',
      ),
    );
  }

  const schemaVersion = manifest.schemaVersion;
  if (schemaVersion === undefined) {
    errors.push(issue('MISSING_SCHEMA_VERSION', 'An art manifest requires a schemaVersion.', 'schemaVersion'));
  } else if (schemaVersion !== ART_MANIFEST_SCHEMA_VERSION) {
    errors.push(
      issue(
        'UNSUPPORTED_SCHEMA_VERSION',
        `Unsupported schemaVersion ${String(schemaVersion)}; this tool supports ${ART_MANIFEST_SCHEMA_VERSION}.`,
        'schemaVersion',
      ),
    );
  }

  if (!hasText(manifest.manifestId)) {
    errors.push(
      issue(
        'MISSING_MANIFEST_ID',
        'A stable internal manifestId is required (not a license claim or external id).',
        'manifestId',
      ),
    );
  }

  const status = hasText(manifest.status) ? manifest.status : undefined;
  if (status !== undefined && !(ART_MANIFEST_STATUSES as readonly string[]).includes(status)) {
    errors.push(
      issue(
        'INVALID_MANIFEST_STATUS',
        `Manifest status must be one of: ${ART_MANIFEST_STATUSES.join(', ')}.`,
        'status',
      ),
    );
  }

  if (manifest.owner !== undefined && manifest.owner !== null && !hasText(manifest.owner)) {
    errors.push(issue('INVALID_OWNER', 'owner must be null or the name of the human art owner.', 'owner'));
  }
  if (manifest.intakeFolder !== undefined && !hasText(manifest.intakeFolder)) {
    errors.push(
      issue('INVALID_INTAKE_FOLDER', 'intakeFolder must be a non-empty path string when present.', 'intakeFolder'),
    );
  }

  // Soft budgets may be overridden by the manifest, but must be positive integers if present.
  let perAssetBudget = options.perAssetBudgetBytes ?? DEFAULT_PER_ASSET_BUDGET_BYTES;
  let totalBudget = options.totalBudgetBytes ?? DEFAULT_TOTAL_BUDGET_BYTES;
  if (manifest.perAssetBudgetBytes !== undefined) {
    if (!isPositiveInt(manifest.perAssetBudgetBytes)) {
      errors.push(
        issue(
          'INVALID_PER_ASSET_BUDGET',
          'perAssetBudgetBytes must be a positive integer number of bytes.',
          'perAssetBudgetBytes',
        ),
      );
    } else {
      perAssetBudget = manifest.perAssetBudgetBytes;
    }
  }
  if (manifest.totalBudgetBytes !== undefined) {
    if (!isPositiveInt(manifest.totalBudgetBytes)) {
      errors.push(
        issue(
          'INVALID_TOTAL_BUDGET',
          'totalBudgetBytes must be a positive integer number of bytes.',
          'totalBudgetBytes',
        ),
      );
    } else {
      totalBudget = manifest.totalBudgetBytes;
    }
  }

  if (!Array.isArray(manifest.assets)) {
    errors.push(issue('MISSING_ASSETS', 'An art manifest requires an "assets" array.', 'assets'));
  }

  const assetInput = Array.isArray(manifest.assets) ? manifest.assets : [];
  const totalSizeBytes = assetInput.reduce<number>((sum, asset) => {
    if (asset && typeof asset === 'object' && !Array.isArray(asset)) {
      const size = (asset as Record<string, unknown>).sizeBytes;
      if (isNonNegativeInt(size)) return sum + size;
    }
    return sum;
  }, 0);

  const batch = validateArtAssets(assetInput, { perAssetBudgetBytes: perAssetBudget });
  for (const result of batch.results) {
    const label = `assets[${result.index}]${result.id ? ` "${result.id}"` : ''}`;
    for (const error of result.errors) {
      errors.push({ ...error, message: `${label}: ${error.message}` });
    }
    for (const warning of result.warnings) {
      warnings.push({ ...warning, message: `${label}: ${warning.message}` });
    }
  }

  // A real manifest must map each id and committed file to exactly one asset record; duplicates
  // would make checksum/size provenance ambiguous. Offline and deterministic, no file IO.
  const seenIds = new Map<string, number>();
  const seenFiles = new Map<string, number>();
  assetInput.forEach((asset, index) => {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return;
    const record = asset as Record<string, unknown>;
    if (hasText(record.id)) {
      const id = record.id.trim();
      const first = seenIds.get(id);
      if (first !== undefined) {
        errors.push(
          issue(
            'DUPLICATE_ASSET_ID',
            `Asset id "${id}" is repeated (first at assets[${first}]); ids must be unique.`,
            'id',
          ),
        );
      } else {
        seenIds.set(id, index);
      }
    }
    if (hasText(record.file)) {
      const file = record.file.trim();
      const first = seenFiles.get(file);
      if (first !== undefined) {
        errors.push(
          issue(
            'DUPLICATE_ASSET_FILE',
            `Asset file "${file}" is repeated (first at assets[${first}]); each committed file needs one provenance record.`,
            'file',
          ),
        );
      } else {
        seenFiles.set(file, index);
      }
    }
  });

  // Consistency guidance: non-blocking, but makes a half-prepared pack obvious.
  if (!hasText(manifest.owner) && batch.total > 0) {
    warnings.push(
      issue(
        'NO_ART_OWNER',
        'No named art owner recorded; a human must sign off before any asset is approved.',
        'owner',
        'warning',
      ),
    );
  }
  if (totalSizeBytes > totalBudget) {
    warnings.push(
      issue(
        'TOTAL_OVER_SIZE_BUDGET',
        `Total asset size (${totalSizeBytes} bytes) exceeds the ${totalBudget}-byte soft budget; keep /home lean (D-019).`,
        'totalBudgetBytes',
        'warning',
      ),
    );
  }
  if (status === 'approved') {
    const decisions = {
      D002: manifest.styleDecision,
      D012: manifest.rightsDecision,
      D018: manifest.licenseDecision,
    };
    const unresolved = Object.entries(decisions)
      .filter(([, value]) => !hasText(value))
      .map(([key]) => key);
    if (unresolved.length > 0) {
      warnings.push(
        issue(
          'APPROVED_MANIFEST_UNRESOLVED_DECISIONS',
          `Manifest is approved but ${unresolved.join(', ')} are not recorded; resolve these owner decisions before release.`,
          'status',
          'warning',
        ),
      );
    }
    if (batch.total === 0) {
      warnings.push(
        issue('APPROVED_MANIFEST_EMPTY', 'A manifest marked approved contains no assets.', 'assets', 'warning'),
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    assets: batch,
    totalSizeBytes,
    ...(typeof schemaVersion === 'number' ? { schemaVersion } : {}),
    ...(status ? { status } : {}),
  };
}
