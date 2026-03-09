# Shared variables for the load-balancer module.
# All components (certificates, url-map, backends) reference these.

variable "production_domain" {
  description = "Canonical production hostname."
  type        = string
}

variable "production_www_domain" {
  description = "WWW hostname for production redirects."
  type        = string
}

variable "production_backend_service_link" {
  description = "Backend service self link for production traffic."
  type        = string
}

# Workbench domains

variable "workbench_prod_domain" {
  description = "Workbench production frontend hostname."
  type        = string
  default     = "workbench.mentalhelp.chat"
}

variable "workbench_prod_api_domain" {
  description = "Workbench production API hostname."
  type        = string
  default     = "api.workbench.mentalhelp.chat"
}

variable "workbench_dev_domain" {
  description = "Workbench development frontend hostname."
  type        = string
  default     = "workbench.dev.mentalhelp.chat"
}

variable "workbench_dev_api_domain" {
  description = "Workbench development API hostname."
  type        = string
  default     = "api.workbench.dev.mentalhelp.chat"
}
