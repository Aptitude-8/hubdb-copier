export interface HubDBColumnOption {
  id?: number;
  name: string;
  label: string;
  order?: number;
  type?: string;
  severity?: number;
}

export interface HubDBColumn {
  id?: string;
  name: string;
  type: string;
  label: string;
  archived?: boolean;
  width?: number;
  description?: string;
  limit?: number;
  options?: HubDBColumnOption[];
  optionCount?: number;
  // Foreign key properties
  foreignTableId?: number;
  foreignColumnId?: number;
  foreignTableName?: string;
  foreignColumnName?: string;
  foreignColumnType?: string;
  // Additional properties from API response
  deleted?: boolean;
  maxNumberOfOptions?: number;
  maxNumberOfCharacters?: number;
  inlineHelpText?: string;
  isHubspotDefined?: boolean;
  fileType?: string;
  isArray?: boolean;
  codeType?: string;
  arrayCountLimits?: any;
  displayType?: string;
  hiddenForPublicApi?: boolean;
}

export interface HubDBTable {
  id: string;
  name: string;
  label: string;
  columns: HubDBColumn[];
  published: boolean;
  columnCount: number;
  rowCount: number;
  archived?: boolean;
  useForPages?: boolean;
  allowChildTables?: boolean;
  enableChildTablePages?: boolean;
  allowPublicApiAccess?: boolean;
  dynamicMetaTags?: Record<string, any>;
}

export interface PagingInfo {
  next?: {
    link: string;
    after: string;
  };
}

export interface TableListResponse {
  total: number;
  results: HubDBTable[];
  paging?: PagingInfo;
}

export interface TableCreateRequest {
  name: string;
  label: string;
  columns: HubDBColumn[];
  useForPages?: boolean;
  allowChildTables?: boolean;
  enableChildTablePages?: boolean;
  allowPublicApiAccess?: boolean;
  dynamicMetaTags?: Record<string, any>;
}

export interface ImportConfig {
  columnMappings?: Array<{
    source: number;
    target: string | number;
  }>;
  skipRows?: number;
  separator?: string;
  encoding?: string;
  format?: string;
  resetTable?: boolean;
  idSourceColumn?: number;
  nameSourceColumn?: number;
  pathSourceColumn?: number;
  childTableSourceColumn?: number;
  primaryKeyColumn?: string;
}

export interface CliOptions {
  sourceToken: string;
  targetToken: string;
  copyContent?: boolean;
}
