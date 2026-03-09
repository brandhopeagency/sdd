# Production environment Terraform configuration
# TODO: Migrate remaining shell-managed resources to Terraform

terraform {
  required_version = ">= 1.5"
}

module "dns" {
  source = "../../dns"

  # Zone name must match the actual Cloud DNS managed zone.
  # Verify with: gcloud dns managed-zones list --project mental-help-global-25
  dns_managed_zone = "mentalhelp-chat"

  # Populate with the global load-balancer IP address.
  # Retrieve with: gcloud compute addresses describe mentalhelp-domain-ip --global --format="value(address)"
  record_values = {
    # Chat domains
    "mentalhelp.chat."                    = var.global_lb_ip_list
    "www.mentalhelp.chat."                = var.global_lb_ip_list
    # Workbench production domains
    "workbench.mentalhelp.chat."          = var.global_lb_ip_list
    "api.workbench.mentalhelp.chat."      = var.global_lb_ip_list
    # Workbench development domains
    "workbench.dev.mentalhelp.chat."      = var.global_lb_ip_list
    "api.workbench.dev.mentalhelp.chat."  = var.global_lb_ip_list
  }
}

module "load_balancer" {
  source = "../../modules/load-balancer"

  production_domain              = var.production_domain
  production_www_domain          = var.production_www_domain
  production_backend_service_link = "projects/mental-help-global-25/global/backendServices/production-domain-backend"

  # Workbench domains
  workbench_prod_domain      = var.workbench_prod_domain
  workbench_prod_api_domain  = var.workbench_prod_api_domain
  workbench_dev_domain       = var.workbench_dev_domain
  workbench_dev_api_domain   = var.workbench_dev_api_domain
}
