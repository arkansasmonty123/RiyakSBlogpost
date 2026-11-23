import type { Investigation, InvestigationStats } from '../api';

type AttentionItem = {
  id: string;
  label: string;
  count: number;
  tab: string;
  tone: 'accent' | 'warning' | 'muted';
};

type NextAction = {
  id: string;
  label: string;
  detail: string;
  tab: string;
};

export interface InvestigationHQProps {
  investigation: Investigation;
  stats: InvestigationStats | null;
  evidenceDiscovered: number;
  evidenceTotal: number;
  checkpointsAnswered: number;
  checkpointsTotal: number;
  accusationCount: number;
  achievementCount: number;
  activityUnread: number;
  fieldResearchNew: number;
  recallDue: number;
  developmentsUnread: number;
  notificationUnread: number;
  caseClosed: boolean;
  onNavigate: (tab: string) => void;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0m';
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

function buildNextActions(props: InvestigationHQProps): NextAction[] {
  if (props.caseClosed) {
    return [
      {
        id: 'review-resolution',
        label: 'Review the resolution',
        detail: 'Compare your reasoning with the case outcome and evidence trail.',
        tab: 'accuse',
      },
      {
        id: 'review-achievements',
        label: 'Check achievements',
        detail: 'See which investigation milestones you unlocked.',
        tab: 'achievements',
      },
    ];
  }

  const actions: NextAction[] = [];
  const push = (action: NextAction) => {
    if (actions.some((existing) => existing.tab === action.tab && existing.label === action.label)) return;
    actions.push(action);
  };

  if (props.activityUnread > 0 || props.notificationUnread > 0) {
    push({
      id: 'review-activity',
      label: 'Review new activity',
      detail: 'Catch up on developments that may change what matters now.',
      tab: 'activity',
    });
  }
  if (props.developmentsUnread > 0) {
    push({
      id: 'review-developments',
      label: 'Read recent developments',
      detail: 'New case updates are waiting in your investigation feed.',
      tab: 'chat',
    });
  }
  if (props.fieldResearchNew > 0) {
    push({
      id: 'field-research',
      label: 'Try Field Research',
      detail: 'New real-world clues are available to investigate.',
      tab: 'discoveries',
    });
  }
  if (props.recallDue > 0) {
    push({
      id: 'recall',
      label: 'Review recall prompts',
      detail: 'A quick recall check can reinforce what you learned.',
      tab: 'discoveries',
    });
  }
  if (props.evidenceDiscovered < props.evidenceTotal) {
    push({
      id: 'examine-evidence',
      label: 'Examine evidence',
      detail: 'Look for undiscovered details and connections in the case file.',
      tab: 'evidence',
    });
  }
  if (props.checkpointsTotal > 0 && props.checkpointsAnswered < props.checkpointsTotal) {
    push({
      id: 'deductions',
      label: 'Work through deductions',
      detail: 'Answer open deduction checkpoints to sharpen your theory.',
      tab: 'deductions',
    });
  }
  push({
    id: 'ask-specialist',
    label: 'Ask a specialist',
    detail: 'Get a second opinion or explanation from the expert team.',
    tab: 'experts',
  });
  push({
    id: 'reality-map',
    label: 'Update Reality Map',
    detail: 'Separate facts, assumptions, and hypotheses before committing.',
    tab: 'reality',
  });
  push({
    id: 'verdict',
    label: 'Submit verdict when ready',
    detail: 'When your evidence and reasoning align, file your accusation.',
    tab: 'accuse',
  });

  return actions.slice(0, 4);
}

export function InvestigationHQ(props: InvestigationHQProps) {
  const {
    investigation,
    stats,
    evidenceDiscovered,
    evidenceTotal,
    checkpointsAnswered,
    checkpointsTotal,
    accusationCount,
    achievementCount,
    activityUnread,
    fieldResearchNew,
    recallDue,
    developmentsUnread,
    notificationUnread,
    caseClosed,
    onNavigate,
  } = props;

  const progress = clampProgress(stats?.progress ?? investigation.progress ?? 0);
  const status = formatStatus(stats?.status ?? investigation.status);
  const elapsed = formatElapsed(stats?.elapsedSeconds ?? 0);

  const attentionItems: AttentionItem[] = ([
    { id: 'activity', label: 'Unread activity', count: activityUnread, tab: 'activity', tone: 'accent' as const },
    { id: 'notifications', label: 'Inbox notifications', count: notificationUnread, tab: 'activity', tone: 'accent' as const },
    { id: 'developments', label: 'New developments', count: developmentsUnread, tab: 'activity', tone: 'warning' as const },
    { id: 'field-research', label: 'New Field Research clues', count: fieldResearchNew, tab: 'discoveries', tone: 'accent' as const },
    { id: 'recall', label: 'Recall prompts due', count: recallDue, tab: 'discoveries', tone: 'warning' as const },
  ] satisfies AttentionItem[]).filter((item) => item.count > 0);

  const nextActions = buildNextActions(props);

  return (
    <section className="investigation-hq" aria-labelledby="investigation-hq-title">
      <div className="investigation-hq__header">
        <div>
          <p className="investigation-hq__eyebrow">Investigation HQ</p>
          <h3 id="investigation-hq-title">Case status at a glance</h3>
          <p className="muted investigation-hq__lede">
            Track what you know, what changed, and where to focus next. This summary never reveals hidden case information.
          </p>
        </div>
        <span className="badge">{status}</span>
      </div>

      <div className="investigation-hq__grid">
        <div className="investigation-hq__card" aria-labelledby="hq-progress-title">
          <h4 id="hq-progress-title">What you know</h4>
          <dl className="investigation-hq__stats">
            <div className="investigation-hq__stat">
              <dt>Progress</dt>
              <dd>{progress}%</dd>
            </div>
            <div className="investigation-hq__stat">
              <dt>Evidence</dt>
              <dd>{evidenceDiscovered} / {evidenceTotal}</dd>
            </div>
            <div className="investigation-hq__stat">
              <dt>Checkpoints</dt>
              <dd>{checkpointsAnswered} / {checkpointsTotal}</dd>
            </div>
            <div className="investigation-hq__stat">
              <dt>Accusations</dt>
              <dd>{accusationCount}</dd>
            </div>
            <div className="investigation-hq__stat">
              <dt>Achievements</dt>
              <dd>{achievementCount}</dd>
            </div>
            <div className="investigation-hq__stat">
              <dt>Time elapsed</dt>
              <dd>{elapsed}</dd>
            </div>
          </dl>
        </div>

        <div className="investigation-hq__card" aria-labelledby="hq-attention-title">
          <h4 id="hq-attention-title">What changed / needs attention</h4>
          {attentionItems.length > 0 ? (
            <ul className="investigation-hq__attention-list">
              {attentionItems.map((item) => (
                <li key={item.id} className={`investigation-hq__attention investigation-hq__attention--${item.tone}`}>
                  <div className="investigation-hq__attention-copy">
                    <span className="investigation-hq__attention-label">{item.label}</span>
                    <span className="investigation-hq__attention-count" aria-label={`${item.count} ${item.label}`}>
                      {item.count}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="link-button investigation-hq__jump"
                    onClick={() => onNavigate(item.tab)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted investigation-hq__empty">
              {caseClosed
                ? 'No new activity. You can review the resolution and your case notes.'
                : 'You are caught up. Review evidence or update your reasoning map when ready.'}
            </p>
          )}
        </div>

        <div className="investigation-hq__card" aria-labelledby="hq-next-title">
          <h4 id="hq-next-title">What you can investigate next</h4>
          <ul className="investigation-hq__actions">
            {nextActions.map((action) => (
              <li key={action.id} className="investigation-hq__action">
                <div>
                  <p className="investigation-hq__action-label">{action.label}</p>
                  <p className="muted investigation-hq__action-detail">{action.detail}</p>
                </div>
                <button
                  type="button"
                  className="small-button"
                  onClick={() => onNavigate(action.tab)}
                >
                  Go
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
