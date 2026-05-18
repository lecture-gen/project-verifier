// CONTEXT_SYSTEM 분석 결과에 대응하는 frontend 타입.
//
// 백엔드의 ProjectContextSchema / ExtractedProjectContextRead 와 1:1 대응한다.
// OpenAPI 재생성 전에도 신규 컴포넌트를 작성할 수 있도록 별도로 유지하는 파일이다.
// 사용자가 백엔드 OpenAPI 재생성을 돌리면 types.gen.ts 의 ExtractedProjectContextRead 가
// 갱신되며, 이 파일은 그 동안의 shim 역할을 한다.

export interface TechStackItem {
  name: string;
  category: string;
  role_in_project: string;
  evidence_path: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  layer: string;
}

export interface ArchitectureEdge {
  source: string;
  target: string;
  label: string;
}

export interface Architecture {
  style: string;
  summary: string;
  layers: string[];
  modules: string[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface StudentImplementationRisk {
  area: string;
  challenge: string;
  why_difficult: string;
  evidence_path: string;
}

export interface LanguageLoc {
  language: string;
  loc: number;
}

export interface FileTreeNode {
  path: string;
  kind: "file" | "dir";
  depth: number;
}

export interface DependencyEntry {
  manifest: string;
  name: string;
  version: string | null;
  scope?: string;
}

export interface ReadmeOutlineEntry {
  level: number;
  text: string;
  source_path?: string;
}

export interface StructuralFacts {
  file_count: number;
  code_file_count: number;
  doc_file_count: number;
  total_loc: number;
  test_ratio: number;
  language_loc: LanguageLoc[];
  file_tree: FileTreeNode[];
  dependencies: DependencyEntry[];
  entry_point_candidates: string[];
  readme_outline: ReadmeOutlineEntry[];
}

export interface ProjectAreaContext {
  id: string;
  evaluation_id: string;
  name: string;
  summary: string;
  role_in_project: string;
  key_concerns: string[];
  source_refs: unknown[];
}

export interface ExtractedProjectContext {
  id: string;
  evaluation_id: string;
  summary: string;
  tech_stack: TechStackItem[];
  features: string[];
  architecture: Architecture;
  student_implementation_risks: StudentImplementationRisk[];
  structural_facts: StructuralFacts;
  question_targets: string[];
  rag_status: Record<string, unknown>;
  areas: ProjectAreaContext[];
  created_at: string;
}
