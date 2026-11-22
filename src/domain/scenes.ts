/**
 * Static, deterministic scene data for the illustrated point-and-click prototype.
 *
 * Visuals are CSS/placeholder only in P0 — no image assets. A `Location` groups one or
 * more `Viewpoint`s; a viewpoint is a single static background with clickable hotspots.
 * `SaveGame.selectedViewpoint` stores only the viewpoint id, so adding locations never
 * changes the save schema.
 */

export interface SceneHotspot {
  id: string;
  label: string;
  /** Action strings are parsed by the UI: `view:<id>`, `panel:<id>`, `time:advance`, `dialogue:<characterId>`. */
  action: string;
}

export interface SceneViewpoint {
  id: string;
  locationId: string;
  label: string;
  description: string;
  hotspots: SceneHotspot[];
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
    label: 'Senior Chamber',
    description: 'Adv. Meera Kulkarni’s office — where the first assignment begins.',
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
    description: 'The chamber door opens into a quiet, book-lined office. The day begins here.',
    hotspots: [
      { id: 'door', label: 'Door', action: 'view:bookshelf' },
      { id: 'senior', label: 'Senior Mentor', action: 'dialogue:senior' },
      { id: 'desk', label: 'Desk', action: 'view:desk' },
      { id: 'window', label: 'Window', action: 'view:window' },
      { id: 'reception', label: 'Door to Reception', action: 'view:reception-desk' },
    ],
  },
  desk: {
    id: 'desk',
    locationId: 'chamber',
    label: 'Desk',
    description: 'Case files, drafts, and notes are spread across the desk, with a junior advocate working at the neighbouring desk.',
    hotspots: [
      { id: 'casefile', label: 'Case File', action: 'panel:case' },
      { id: 'assignments', label: 'Assignments', action: 'panel:assignments' },
      { id: 'draft', label: 'Draft Pad', action: 'panel:draft' },
      { id: 'colleague', label: 'Junior Advocate (Priya)', action: 'dialogue:junior' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
  bookshelf: {
    id: 'bookshelf',
    locationId: 'chamber',
    label: 'Bookshelf',
    description: 'Legal texts and reference materials line the wall. Only verified sources should be cited.',
    hotspots: [
      { id: 'research', label: 'Legal Research', action: 'panel:research' },
      { id: 'notebook', label: 'Notebook', action: 'panel:notebook' },
      { id: 'evidence', label: 'Evidence', action: 'panel:evidence' },
      { id: 'casework', label: 'Casework', action: 'panel:casework' },
      { id: 'journal', label: 'Timeline / Journal', action: 'panel:journal' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },
  window: {
    id: 'window',
    locationId: 'chamber',
    label: 'Window',
    description: 'Outside, the district moves on its own schedule. The world does not wait for the player.',
    hotspots: [
      { id: 'clock', label: 'Advance Time', action: 'time:advance' },
      { id: 'back', label: 'Back to Entrance', action: 'view:entrance' },
    ],
  },

  // --- Second location: Office Reception / corridor / waiting area ---
  'reception-desk': {
    id: 'reception-desk',
    locationId: 'reception',
    label: 'Reception Desk',
    description: 'A low desk, a visitor diary and a waiting area beyond it. The front desk sees who comes and goes — not what is said in private.',
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
    description: 'A narrow corridor between the reception desk and the consulting rooms. Time only moves when you choose to advance the in-game clock.',
    hotspots: [
      { id: 'opposing', label: 'Opposing Counsel', action: 'dialogue:opposing' },
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
    description: 'Two chairs and a noticeboard. Clients and counsel wait here; private conversations stay behind closed doors.',
    hotspots: [
      { id: 'receptionist', label: 'Receptionist (Deepa)', action: 'dialogue:receptionist' },
      { id: 'opposing', label: 'Opposing Counsel', action: 'dialogue:opposing' },
      { id: 'corridor', label: 'Corridor', action: 'view:corridor' },
      { id: 'consultation', label: 'Consultation Room', action: 'view:consultation-room' },
      { id: 'back', label: 'Back to Chamber', action: 'view:entrance' },
    ],
  },
  'consultation-room': {
    id: 'consultation-room',
    locationId: 'reception',
    label: 'Consultation Room',
    description: 'A small room off the corridor where colleagues and visiting specialists review a record together. A professional discussion here is not a finding on the case.',
    hotspots: [
      { id: 'medical', label: 'Medical Consultant (Dr. Kavita Iyer)', action: 'dialogue:medical' },
      { id: 'junior', label: 'Junior Advocate (Priya)', action: 'dialogue:junior' },
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
