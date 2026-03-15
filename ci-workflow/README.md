# CI Workflow

Copy `ci.yml` to `.github/workflows/ci.yml` to activate the GitHub Actions CI pipeline.

This file is staged here because the CI token lacks the `workflow` OAuth scope
required to push files under `.github/workflows/`.

```bash
mkdir -p .github/workflows
cp ci-workflow/ci.yml .github/workflows/ci.yml
```
