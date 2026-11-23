/**
 * Static, deterministic scene data for the illustrated point-and-click prototype.
 *
 * Visuals are original inline SVG/CSS — no external image assets. A `Location` groups
 * one or more `Viewpoint`s; a viewpoint is a single static illustrated background with
 * clickable hotspots. `SaveGame.selectedViewpoint` stores only the viewpoint id, so
 * adding locations/viewpoints never changes the save schema.
 *
 * The architecture is data-driven: hotspots, character presence and viewpoint metadata
 * are declared here; SceneArt renders them through reusable scene/character primitives.
 */

export type HotspotKind = 'navigation' | 'panel' | 'time' | 'dialogue' | 'interaction';

/** Static expression ids used by illustrated character sprites in scene art. */
export type SceneExpression = 'neutral' | 'thinking' | 'speaking' | 'concerned' | 'approving';

export interface SceneCharacterPresence {
  /** Character id from the domain (e.g. `senior`). */
  characterId: string;
  /** Static expression to render for this viewpoint composition. */
  expression: SceneExpression;
  /** Horizontal placement hint for reusable scene composition. */
  position: 'left' | 'center' | 'right';
  /** Accessible label used as decorative context; real interaction stays on hotspot buttons. */
  label: string;
}

export interface SceneHotspot {
  id: string;
  label: string;
  /** Action strings are parsed by the UI: `view:<id>`, `panel:<id>`, `time:advance`, `dialogue:<characterId>`. */
  action: string;
  /** Optional semantic kind for styling/testing; action remains the source of behavior. */
  kind?: HotspotKind;
  /** When present, hotspot represents a character interaction point. */
  characterId?: string;
}

export interface SceneViewpoint {
  id: string;
  locationId: string;
  label: string;
  description: string;
  hotspots: SceneHotspot[];
  /** Optional illustrated character(s) present in this viewpoint. Decorative only. */
  characters?: SceneCharacterPresence[];
}

export interface SceneLocation {
  id: string;
  label: string;
  description: string;
  viewpointIds: string[];
}

export const LOCATIONS: Record<string, SceneLocation> = {
  chamber: {
    id: 'chamber',
    label: "Senior's Chamber",
    description:
      'Adv. Meera Kulkarni’s office — a wood-and-brass Indian legal chamber where the first assignment begins.',
    viewpointIds: ['entrance', 'desk', 'bookshelf', 'window'],
  },
  reception: {
    id: 'reception',
    label: 'Office Reception',
    description: 'The front desk, corridor, waiting area and consultation room just outside the chamber.',
    viewpointIds: ['reception-desk', 'corridor', 'waiting-area', 'consultation-room'],
  },
};

export const VIEWPOINTS: Record<string, SceneViewpoint> = {
  // --- Senior Chamber (original location) ---
  entrance: {
    id: 'entrance',
    locationId: 'chamber',
    label: 'Entrance',
    description:
      'The chamber door opens into a quiet, wood-lined office. Adv. Meera Kulkarni looks up from her work as you enter.',
    characters: [{ characterId: 'senior', expression: 'approving', position: 'right', label: 'Adv. Meera Kulkarni' }],
    hotspots: [
      { id: 'door', label: 'Door', action: 'view:bookshelf', kind: 'navigation' },
      { id: 'senior', label: 'Senior Mentor', action: 'dialogue:senior', kind: 'dialogue', characterId: 'senior' },
      { id: 'desk', label: 'Desk', action: 'view:desk', kind: 'navigation' },
      { id: 'window', label: 'Window', action: 'view:window', kind: 'navigation' },
      { id: 'reception', label: 'Door to Reception', action: 'view:reception-desk', kind: 'navigation' },
    ],
  },
  desk: {
    id: 'desk',
    locationId: 'chamber',
    label: 'Desk',
    description:
      'Case files, drafts, and notes are spread across the desk. Meera reviews a draft while a junior advocate works nearby.',
    characters: [{ characterId: 'senior', expression: 'thinking', position: 'left', label: 'Adv. Meera Kulkarni' }],
    hotspots: [
      { id: 'casefile', label: 'Case File', action: 'panel:case', kind: 'panel' },
      { id: 'assignments', label: 'Assignments', action: 'panel:assignments', kind: 'panel' },
      { id: 'draft', label: 'Draft Pad', action: 'panel:draft', kind: 'panel' },
      {
        id: 'senior',
        label: 'Discuss with Senior',
        action: 'dialogue:senior',
        kind: 'dialogue',
        characterId: 'senior',
      },
      {
        id: 'colleague',
        label: 'Junior Advocate (Priya)',
        action: 'dialogue:junior',
        kind: 'dialogue',
        characterId: 'junior',
      },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance', kind: 'navigation' },
    ],
  },
  bookshelf: {
    id: 'bookshelf',
    locationId: 'chamber',
    label: 'Bookshelf',
    description:
      'Legal texts and reference materials line the wall. Meera points out a source to verify — only verified sources should be cited.',
    characters: [{ characterId: 'senior', expression: 'speaking', position: 'right', label: 'Adv. Meera Kulkarni' }],
    hotspots: [
      { id: 'research', label: 'Legal Research', action: 'panel:research', kind: 'panel' },
      { id: 'notebook', label: 'Notebook', action: 'panel:notebook', kind: 'panel' },
      { id: 'evidence', label: 'Evidence', action: 'panel:evidence', kind: 'panel' },
      { id: 'casework', label: 'Casework', action: 'panel:casework', kind: 'panel' },
      { id: 'journal', label: 'Timeline / Journal', action: 'panel:journal', kind: 'panel' },
      {
        id: 'senior',
        label: 'Ask Senior about Sources',
        action: 'dialogue:senior',
        kind: 'dialogue',
        characterId: 'senior',
      },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance', kind: 'navigation' },
    ],
  },
  window: {
    id: 'window',
    locationId: 'chamber',
    label: 'Window',
    description:
      'Outside, the district moves on its own schedule. Meera pauses, weighing the day’s work before the clock moves on.',
    characters: [{ characterId: 'senior', expression: 'concerned', position: 'left', label: 'Adv. Meera Kulkarni' }],
    hotspots: [
      { id: 'clock', label: 'Advance Time', action: 'time:advance', kind: 'time' },
      {
        id: 'senior',
        label: 'Check in with Senior',
        action: 'dialogue:senior',
        kind: 'dialogue',
        characterId: 'senior',
      },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance', kind: 'navigation' },
    ],
  },

  // --- Second location: Office Reception / corridor / waiting area ---
  'reception-desk': {
    id: 'reception-desk',
    locationId: 'reception',
    label: 'Reception Desk',
    description:
      'A low desk, a visitor diary and a waiting area beyond it. The front desk sees who comes and goes — not what is said in private.',
    hotspots: [
      { id: 'receptionist', label: 'Receptionist (Deepa)', action: 'dialogue:receptionist' },
      { id: 'diary', label: 'Visitor Diary', action: 'dialogue:receptionist' },
      { id: 'corridor', label: 'Corridor', action: 'view:corridor' },
      { id: 'waiting', label: 'Waiting Area', action: 'view:waiting-area' },
      { id: 'back', label: 'Back to Chamber', action: 'view:entrance' },
    ],
  },
  corridor: {
    id: 'corridor',
    locationId: 'reception',
    label: 'Corridor',
    description:
      'A narrow corridor between the reception desk and the consulting rooms. Counsel from neighbouring chambers pass through here; time only moves when you choose to advance the in-game clock.',
    hotspots: [
      { id: 'opposing', label: 'Opposing Counsel', action: 'dialogue:opposing' },
      { id: 'rival', label: 'Adv. Nisha Deshmukh (Rival)', action: 'dialogue:rival' },
      { id: 'consultation', label: 'Consultation Room', action: 'view:consultation-room' },
      { id: 'reception-desk', label: 'Reception Desk', action: 'view:reception-desk' },
      { id: 'waiting', label: 'Waiting Area', action: 'view:waiting-area' },
      { id: 'back', label: 'Back to Chamber', action: 'view:entrance' },
    ],
  },
  'waiting-area': {
    id: 'waiting-area',
    locationId: 'reception',
    label: 'Waiting Area',
    description:
      'Two chairs and a noticeboard. Clients and counsel wait here, and the canteen supervisor has come by with a duty roster; private conversations stay behind closed doors.',
    hotspots: [
      { id: 'receptionist', label: 'Receptionist (Deepa)', action: 'dialogue:receptionist' },
      { id: 'opposing', label: 'Opposing Counsel', action: 'dialogue:opposing' },
      { id: 'rival', label: 'Adv. Nisha Deshmukh (Rival)', action: 'dialogue:rival' },
      { id: 'supervisor', label: 'Canteen Supervisor (Iqbal Sheikh)', action: 'dialogue:supervisor' },
      { id: 'corridor', label: 'Corridor', action: 'view:corridor' },
      { id: 'consultation', label: 'Consultation Room', action: 'view:consultation-room' },
      { id: 'back', label: 'Back to Chamber', action: 'view:entrance' },
    ],
  },
  'consultation-room': {
    id: 'consultation-room',
    locationId: 'reception',
    label: 'Consultation Room',
    description:
      'A small room off the corridor where colleagues, visiting specialists and records custodians review a record together. A professional discussion here is not a finding on the case.',
    hotspots: [
      { id: 'medical', label: 'Medical Consultant (Dr. Kavita Iyer)', action: 'dialogue:medical' },
      { id: 'junior', label: 'Junior Advocate (Priya)', action: 'dialogue:junior' },
      { id: 'supervisor', label: 'Canteen Supervisor (Iqbal Sheikh)', action: 'dialogue:supervisor' },
      { id: 'corridor', label: 'Corridor', action: 'view:corridor' },
      { id: 'back', label: 'Back to Chamber', action: 'view:entrance' },
    ],
  },
};

/** Stable list for validation/navigation; insertion order is also the UI order. */
export const ALL_VIEWPOINT_IDS = Object.keys(VIEWPOINTS);
export const ALL_LOCATION_IDS = Object.keys(LOCATIONS);

export function isValidViewpoint(id: unknown): id is string {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(VIEWPOINTS, id);
}

export function getViewpoint(id: string): SceneViewpoint {
  return isValidViewpoint(id) ? VIEWPOINTS[id] : VIEWPOINTS.entrance;
}

export function getLocationForViewpoint(id: string): SceneLocation {
  const viewpoint = getViewpoint(id);
  return LOCATIONS[viewpoint.locationId] ?? LOCATIONS.chamber;
}

export function viewpointsForLocation(locationId: string): SceneViewpoint[] {
  const location = LOCATIONS[locationId];
  if (!location) return [];
  return location.viewpointIds.map((id) => VIEWPOINTS[id]).filter((v): v is SceneViewpoint => Boolean(v));
}

/** Human-readable hint shown under a hotspot button in the scene panel. */
export function describeHotspotAction(action: string): string {
  const [kind, value] = action.split(':');
  if (kind === 'view') return 'Move to viewpoint';
  if (kind === 'panel') return `Open ${value} panel`;
  if (kind === 'time') return 'Advance in-game time';
  if (kind === 'dialogue') return 'Start conversation';
  return 'Interact';
}
