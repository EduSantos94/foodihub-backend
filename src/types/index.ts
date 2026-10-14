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
  is_platform_admin: boolean;
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
  category_id?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  amount?: number;
  category_id?: string;
  active?: boolean;
}

export interface ProductResponse {
  id: string;
  store_id: string;
  category_id?: string;
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

// ==================== Category ====================
export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  active?: boolean;
}

export interface CategoryResponse {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== Customer ====================
export interface CreateCustomerRequest {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export interface UpdateCustomerRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  active?: boolean;
}

export interface CustomerResponse {
  id: string;
  store_id: string;
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== Supplier ====================
export interface CreateSupplierRequest {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  active?: boolean;
}

export interface SupplierResponse {
  id: string;
  store_id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== Image ====================
export type ImageEntityType = 'store' | 'product' | 'supplier' | 'banner' | 'category' | 'promotional' | 'other';

export interface CreateImageRequest {
  entity_type: ImageEntityType;
  entity_id?: string;
  filename: string;
  url_original: string;
  url_thumbnail?: string;
  file_size?: number;
  mime_type?: string;
  dimensions?: string;
}

export interface UpdateImageRequest {
  entity_type?: ImageEntityType;
  entity_id?: string;
  url_thumbnail?: string;
  active?: boolean;
}

export interface ImageResponse {
  id: string;
  store_id: string;
  entity_type: ImageEntityType;
  entity_id?: string;
  filename: string;
  url_original: string;
  url_thumbnail?: string;
  file_size?: number;
  mime_type?: string;
  dimensions?: string;
  active: boolean;
  uploaded_at: Date;
}

// ==================== Supply ====================
export type SupplyType = 'ingredient' | 'packaging' | 'cleaning' | 'other';

export interface CreateSupplyRequest {
  name: string;
  type?: SupplyType;
  unit_measure: string;
  amount?: number;
  description?: string;
}

export interface UpdateSupplyRequest {
  name?: string;
  type?: SupplyType;
  unit_measure?: string;
  amount?: number;
  description?: string;
  active?: boolean;
}

export interface SupplyResponse {
  id: string;
  store_id: string;
  name: string;
  type: SupplyType;
  unit_measure: string;
  amount: number;
  description?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== Purchase ====================
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'pix' | 'other';

export interface CreatePurchaseItemRequest {
  supply_id: string;
  quantity: number;
  unit_price: number;
  batch_number?: string;
  manufacturing_date?: string;
  expiry_date?: string;
}

export interface CreatePurchaseRequest {
  supplier_id: string;
  purchase_date: string;
  delivery_date?: string;
  purchase_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  payment_method?: PaymentMethod;
  notes?: string;
  items: CreatePurchaseItemRequest[];
}

export interface UpdatePurchaseRequest {
  purchase_date?: string;
  delivery_date?: string;
  purchase_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  paid_amount?: number;
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_date?: string;
  notes?: string;
}

export interface PurchaseItemResponse {
  id: string;
  purchase_id: string;
  supply_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  batch_number?: string;
  manufacturing_date?: Date;
  expiry_date?: Date;
}

export interface PurchaseResponse {
  id: string;
  store_id: string;
  supplier_id: string;
  purchase_number?: string;
  purchase_date: Date;
  delivery_date?: Date;
  invoice_number?: string;
  invoice_date?: Date;
  total_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  payment_date?: Date;
  notes?: string;
  items?: PurchaseItemResponse[];
  created_at: Date;
  updated_at: Date;
}

// ==================== Sale ====================
export type SaleStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type SalePaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer';
export type SalePaymentStatus = 'pending' | 'paid' | 'cancelled';
export type DeliveryType = 'takeout' | 'delivery' | 'dine_in';
export type SaleOrigin = 'ifood' | 'aiqfome' | 'manual' | 'app' | 'web';
export type SyncStatus = 'pending' | 'synced' | 'error' | 'cancelled';

export interface CreateSaleItemRequest {
  product_id: string;
  product_size_id?: string;
  quantity: number;
  notes?: string;
}

export interface CreateSaleIntegrationRequest {
  integration_id: string;
  origin: SaleOrigin;
  external_id?: string;
  external_order_number?: string;
  origin_data?: Record<string, unknown>;
}

export interface CreateSaleRequest {
  customer_id?: string;
  sale_number?: string;
  delivery_type?: DeliveryType;
  delivery_address?: string;
  discount?: number;
  tax?: number;
  payment_method?: SalePaymentMethod;
  notes?: string;
  items: CreateSaleItemRequest[];
  integration?: CreateSaleIntegrationRequest;
}

export interface UpdateSaleRequest {
  status?: SaleStatus;
  delivery_address?: string;
  payment_method?: SalePaymentMethod;
  payment_status?: SalePaymentStatus;
  notes?: string;
}

export interface SaleItemResponse {
  id: string;
  sale_id: string;
  product_id: string;
  product_size_id?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

export interface SaleIntegrationResponse {
  id: string;
  sale_id: string;
  integration_id: string;
  origin: SaleOrigin;
  external_id?: string;
  external_order_number?: string;
  origin_data?: Record<string, unknown>;
  sync_status: SyncStatus;
  last_sync?: Date;
}

export interface SaleResponse {
  id: string;
  store_id: string;
  customer_id?: string;
  sale_number?: string;
  sale_date: Date;
  delivery_type: DeliveryType;
  delivery_address?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  status: SaleStatus;
  payment_method: SalePaymentMethod;
  payment_status: SalePaymentStatus;
  paid_at?: Date;
  notes?: string;
  created_by?: string;
  items?: SaleItemResponse[];
  integration?: SaleIntegrationResponse;
  created_at: Date;
  updated_at: Date;
}

// ==================== Integration ====================
export type IntegrationType = 'ifood' | 'aiqfome' | 'custom';
export type IntegrationStatus = 'active' | 'inactive' | 'error';

export interface CreateIntegrationRequest {
  name: string;
  type: IntegrationType;
  api_key?: string;
  api_secret?: string;
  webhook_url?: string;
  config?: Record<string, unknown>;
}

export interface UpdateIntegrationRequest {
  name?: string;
  api_key?: string;
  api_secret?: string;
  webhook_url?: string;
  status?: IntegrationStatus;
  config?: Record<string, unknown>;
  active?: boolean;
}

// Secrets (api_key, api_secret, webhook_token) are never returned
export interface IntegrationResponse {
  id: string;
  store_id: string;
  name: string;
  type: IntegrationType;
  has_api_key: boolean;
  has_api_secret: boolean;
  webhook_url?: string;
  status: IntegrationStatus;
  last_sync?: Date;
  last_error?: string;
  config?: Record<string, unknown>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== Webhook ====================
export type WebhookEventStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';

export interface CreateWebhookRequest {
  event_type: string;
  endpoint_url: string;
  max_retries?: number;
}

export interface UpdateWebhookRequest {
  event_type?: string;
  endpoint_url?: string;
  max_retries?: number;
  active?: boolean;
}

export interface WebhookResponse {
  id: string;
  integration_id: string;
  event_type: string;
  endpoint_url: string;
  webhook_token: string;
  active: boolean;
  retry_count: number;
  max_retries: number;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEventResponse {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  response_status?: number;
  response_body?: string;
  status: WebhookEventStatus;
  attempt_count: number;
  last_attempt?: Date;
  next_retry?: Date;
  created_at: Date;
}
