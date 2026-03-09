variable "dns_managed_zone" {
  description = "Managed DNS zone name that hosts mentalhelp domains."
  type        = string
}

variable "record_values" {
  description = <<-EOT
    A-record values per hostname.  Values MUST be populated with the global
    load-balancer IP address in the environment tfvars file (e.g.
    terraform.tfvars).  Empty lists will create DNS records with no IP and
    break domain resolution.
  EOT
  type        = map(list(string))
  default = {
    # Chat domains
    "mentalhelp.chat."                    = []
    "www.mentalhelp.chat."                = []
    # Workbench production domains
    "workbench.mentalhelp.chat."          = []
    "api.workbench.mentalhelp.chat."      = []
    # Workbench development domains
    "workbench.dev.mentalhelp.chat."      = []
    "api.workbench.dev.mentalhelp.chat."  = []
  }

  validation {
    condition     = alltrue([for v in values(var.record_values) : length(v) > 0])
    error_message = "All record_values must contain at least one IP address. Populate with the global load-balancer IP."
  }
}

resource "google_dns_record_set" "domain_records" {
  for_each = var.record_values

  name         = each.key
  managed_zone = var.dns_managed_zone
  type         = "A"
  ttl          = 300
  rrdatas      = each.value
}
