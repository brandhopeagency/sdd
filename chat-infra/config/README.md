# Configuration bootstrap for infra automation

The automation scripts in `scripts/` expect local JSON files under `config/`.
Real config files are intentionally gitignored because they can contain
environment-specific values.

## Initialize local config

```bash
cp config/secrets.json.example config/secrets.json
cp config/github-repos.json.example config/github-repos.json
cp config/github-envs/dev.json.example config/github-envs/dev.json
cp config/github-envs/prod.json.example config/github-envs/prod.json
```

Then edit the copied `.json` files for your project and organization.

## File map

- `config/secrets.json` - Secret inventory and generation policy.
- `config/github-repos.json` - Repo list, environment assignments, branch protection defaults.
- `config/github-envs/dev.json` - Dev environment secret bindings and variables.
- `config/github-envs/prod.json` - Prod environment secret bindings and variables.

Use `./scripts/verify.sh` after setup to validate drift and access.
