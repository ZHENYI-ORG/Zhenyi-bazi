export type JudgmentLayer='original'|'dayun'|'liunian';
export type JudgmentPillar='year'|'month'|'day'|'hour';
export type NodePosition='stem'|'branch'|'hidden_stem';
export type GongStatus='effective'|'conditional'|'intent_only'|'broken'|'invalid';
export type OwnershipState='mostly_native'|'shared'|'mostly_external'|'unclear';
export type EvidenceGrade='S'|'A'|'B'|'C';
export type RuleStatus='verified'|'school_specific'|'case_only'|'disputed';

export interface FactNode{
  id:string;
  layer:JudgmentLayer;
  pillar:JudgmentPillar;
  position:NodePosition;
  char:string;
  element:string;
  yinYang?:string;
  tenGod?:string;
  visibility:'visible'|'hidden';
  hiddenLevel?:string;
  parentBranchId?:string;
  isDayMaster?:boolean;
}

export interface RelationFact{
  id:string;
  layer:JudgmentLayer;
  type:string;
  nodes:string[];
  source:'standard'|'school_whitelist'|string;
  status:'fact'|'candidate'|string;
  direction?:string;
  distance?:number;
  adjacent?:boolean;
  medium?:string;
  school?:string;
  result_element?:string;
}

export interface RelationSemantic{
  relationId:string;
  semantic:string;
  gate:'passed'|'conditional'|'failed';
  evidence:string[];
  counterEvidence:string[];
  ruleId:string;
}

export interface OwnershipResult{
  result:OwnershipState;
  resultNodes:string[];
  reasonChain:string[];
  confidence:'high'|'medium'|'low';
}

export interface GongPath{
  id:string;
  type:string;
  title:string;
  actorNodes:string[];
  leadActorNodes?:string[];
  targetNodes:string[];
  bridgeNodes:string[];
  resultNodes:string[];
  relationIds:string[];
  roleMap:Record<string,string>;
  status:GongStatus;
  ownership?:OwnershipResult;
  gongDirection?:'forward'|'reverse'|'internal'|'external'|'mixed';
  zhengFan?:'zheng'|'fan'|'mixed'|'unclear';
  rank_score?:number;
  gong_level?:'L0'|'L1'|'L2'|'L3'|'L4'|'L5';
  ruleId?:string;
  rawReason?:string;
  validation?:Record<string,unknown>;
}

export interface JudgmentPresentation{
  title:string;
  type_label:string;
  status_label:string;
  summary:string;
  ownership_label:string;
  zheng_fan_label:string;
  timing_label:string;
  qishi_label:string;
  engine_note:string;
  [key:string]:unknown;
}

export interface BlindJudgmentResult{
  ok:true;
  engine_version:string;
  rule_version:string;
  generated_at:string;
  facts:any;
  relations:RelationFact[];
  relation_semantics:RelationSemantic[];
  guest_host:any;
  roots:any[];
  origins:any[];
  intents:any[];
  qishi:any;
  gong_paths:GongPath[];
  mainline:{primary:GongPath|null;secondary:GongPath|null;co_primary:boolean;reason:string};
  xiang:any;
  timing:any;
  evidence:any[];
  warnings:string[];
  presentation:JudgmentPresentation;
}
