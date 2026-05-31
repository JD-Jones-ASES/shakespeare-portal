/**
 * TypeScript mirror of the JSON Schemas in schemas/.
 * Keep these in sync when schemas change.
 */

export type Genre =
  | 'Tragedy'
  | 'Comedy'
  | 'History'
  | 'Romance'
  | 'Tragicomedy'
  | 'Poem'
  | 'Sonnet_Sequence';

export type ContentWarning =
  | 'violence'
  | 'suicide'
  | 'intimate_partner_violence'
  | 'sexual_assault'
  | 'sexual_coercion'
  | 'infanticide'
  | 'child_abuse'
  | 'elder_abuse'
  | 'mutilation'
  | 'racism'
  | 'antisemitism'
  | 'misogyny'
  | 'religious_persecution'
  | 'enslavement'
  | 'war_atrocity'
  | 'mental_health_crisis';

export interface CatalogEntry {
  playId: string;
  title: string;
  title_short: string;
  genre: Genre;
  subgenre?: string;
  date_written: string;
  date_first_performed?: string;
  date_published?: string;
  act_count: number;
  scene_count: number;
  line_count?: number;
  characters_major?: string[];
  primary_sources?: string[];
  setting?: string;
  themes?: string[];
  difficulty_rating?: number;
  curriculum_grade_level?: number[];
  common_in_curriculum?: boolean;
  content_warning?: ContentWarning[];
  synopsis_short?: string;
  folger_url?: string;
  mit_url?: string;
  wikipedia_url?: string;
}

export type AnnotationType =
  | 'archaic_vocab'
  | 'biblical_allusion'
  | 'classical_allusion'
  | 'historical_topical'
  | 'bawdy_pun'
  | 'rhetorical_device'
  | 'wordplay'
  | 'syntax_grammar'
  | 'stage_direction_note'
  | 'textual_variant'
  | 'parallel_passage'
  | 'cultural_context';

export type Depth = 'basic' | 'scholar';
export type Confidence = 'high' | 'medium' | 'uncertain';

export interface Source {
  name: string;
  citation: string;
  url?: string;
}

export interface Reference {
  kind: 'biblical' | 'classical' | 'historical';
  card_id: string;
}

export interface FactCheckVerdict {
  judge: 'source' | 'anchor' | 'interpretation';
  model: string;
  verdict: 'verified' | 'refuted' | 'uncertain';
  note: string;
}

export interface Annotation {
  id: string;
  play: string;
  tln_start: number;
  tln_end: number;
  word_start: number;
  word_end: number;
  anchor_text: string;
  type: AnnotationType;
  depth: Depth;
  summary: string;
  detail?: string;
  references?: Reference[];
  sources: Source[];
  confidence: Confidence;
  generated_by: string;
  fact_checked: boolean;
  fact_checked_by?: string[];
  fact_checked_at?: string;
  fact_check_verdicts?: FactCheckVerdict[];
  note_internal?: string;
}

export interface Line {
  kind: 'spoken' | 'stage_direction' | 'scene_header' | 'blank';
  tln?: number;
  speaker?: string;
  speaker_raw?: string;
  speaker_id?: string;
  text?: string;
  stage_directions?: string[];
}

export interface Scene {
  id: string;
  number: number;
  title?: string;
  setting?: string;
  tln_start?: number;
  tln_end?: number;
  lines: Line[];
}

export interface Act {
  id: string;
  number: number;
  title?: string;
  scenes: Scene[];
}

export interface PlayText {
  play: string;
  title: string;
  source?: { edition: string; file: string; ingested_at?: string };
  tln_count?: number;
  acts: Act[];
}

export interface Character {
  id: string;
  name: string;
  aliases?: string[];
  role: 'protagonist' | 'antagonist' | 'deuteragonist' | 'major' | 'supporting' | 'minor' | 'chorus' | 'ensemble';
  description?: string;
  color?: string;
  relationships?: { other_id: string; relation: string }[];
  first_appearance?: { act: number; scene: number; tln: number };
  speech_count?: number;
  key_lines?: { tln: number; text: string; why: string }[];
}

export interface ReferenceCard {
  id: string;
  kind: 'biblical' | 'classical' | 'historical';
  title: string;
  source: Source;
  summary_basic: string;
  detail_scholar?: string;
  related_plays?: string[];
  see_also?: Reference[];
}

export interface ReferenceCardFile {
  kind: 'biblical' | 'classical' | 'historical';
  cards: ReferenceCard[];
}

export interface SynopsisScene {
  number: number;
  summary: string;
  themes?: string[];
}

export interface SynopsisAct {
  number: number;
  summary: string;
  scenes: SynopsisScene[];
}

export interface Synopsis {
  play: string;
  overview: string;
  acts: SynopsisAct[];
}

export interface GlossaryEntry {
  surface: string;
  normalized: string;
  definition: string;
  pos?: string;
}

export interface Glossary {
  play: string;
  entries: GlossaryEntry[];
}
