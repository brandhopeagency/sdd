variable "production_domain" {
  description = "Canonical production hostname."
  type        = string
  default     = "mentalhelp.chat"
}

variable "production_www_domain" {
  description = "WWW hostname that redirects to canonical production domain."
  type        = string
  default     = "www.mentalhelp.chat"
}

variable "production_access_mode" {
  description = "Access mode for production domain."
  type        = string
  default     = "public"
}

variable "global_lb_ip_list" {
  description = "Global load-balancer IP as a single-element list for DNS A-records. Retrieve with: gcloud compute addresses describe mentalhelp-domain-ip --global --format='value(address)'"
  type        = list(string)
}

# Workbench domain variables

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
