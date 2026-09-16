/**
 * Tipos TypeScript para requisições e respostas da API
 */

// ==================== Store ====================
export interface CreateStoreRequest {
  name: string;
  email: string;
  phone?: string;
  document: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}

export interface UpdateStoreRequest {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}

export interface StoreResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  document: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== User ====================
export interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string;
}

export interface UpdateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  active?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== Auth ====================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: UserResponse;
}

export interface RegisterRequest {
  store_name: string;
  store_email: string;
  store_document: string;
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
}

// ==================== Audit Log ====================
export interface AuditLogResponse {
  id: string;
  store_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
  created_at: Date;
}

// ==================== Error Response ====================
export interface ErrorResponse {
  error: string;
  message: string;
  status_code: number;
  timestamp: Date;
}

// ==================== Pagination ====================
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ==================== Request Context ====================
export interface RequestContext {
  store_id: string;
  user_id: string;
  user_role: string;
  email: string;
}

// ==================== Product ====================
export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  amount?: number;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  amount?: number;
  active?: boolean;
}

export interface ProductResponse {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  price: number;
  amount: number;
  active: boolean;
  sizes?: ProductSizeResponse[];
  created_at: Date;
  updated_at: Date;
}

// ==================== Product Size ====================
export interface CreateProductSizeRequest {
  name: string;
}

export interface UpdateProductSizeRequest {
  name?: string;
  active?: boolean;
}

export interface ProductSizeResponse {
  id: string;
  product_id: string;
  store_id: string;
  name: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
