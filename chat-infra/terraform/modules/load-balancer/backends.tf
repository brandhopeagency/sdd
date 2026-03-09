# Backend service for production domain traffic.
# Variables are declared in variables.tf.
#
# NOTE: The backend block is intentionally empty because the actual NEG
# attachments are managed via gcloud provisioning scripts. Terraform
# tracks the backend service shell; the scripts attach serverless NEGs.

resource "google_compute_backend_service" "production_domain_backend" {
  name                  = "production-domain-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  # Cloud Armor security policy should be attached after initial provisioning.
  # TODO: Create google_compute_security_policy resource and reference here.
  security_policy = null
}
