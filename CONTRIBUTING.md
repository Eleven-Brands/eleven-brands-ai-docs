# Contributing to Eleven Brands Repositories

This document outlines the process for contributing code, reporting issues, and maintaining quality across all Eleven Brands repositories.

> **Note:** Before you begin, make sure your local setup is fully up‑to‑date by following [setup_local_development.md](setup_local_development.md)

## Who Can Contribute

Only current developers at Eleven Brands are permitted to contribute to these repositories. If you are unsure whether you have access or rights, please consult the project maintainer.

## Project Structure

Each repository has its own internal structure. Before making changes, read the repo's `README.md` and `CLAUDE.md` (if present) to understand its conventions and folder layout.

Please follow the existing folder structure within each repo and reuse shared utilities when possible.

## Contribution Guidelines

### 1. Development Workflow

1. **Always start from `main`:**
     ```bash
     git checkout main
     git pull origin main
     ```

2. Create your work branch from main (choose the right “type”):

     ```bash
     git checkout -b <type>/<scope>
     git push -u origin <type>/<scope>

     # Pick a type that fits your work:
     # • feat      – for new features or enhancements
     # • fix       – for bug fixes
     # • hotfix    – for urgent fixes that go directly to production
     # • chore     – for maintenance, dependencies, config, etc.
     # • docs      – for documentation changes only
     # • refactor  – for code restructuring without changing behavior
     # • release   – for release preparation commits

     # Example: Sales Dashboard app
     git checkout -b app/sales-dashboard
     git push -u origin app/sales-dashboard
     ```

3. Write code & commit with clear messages as you go.

4. Interactive rebase to clean up branch history regularly AND before merging or making PRs to keep history clean & concise:

     ```bash
     git checkout <your-branch>
     git fetch origin
     git rebase -i origin/main
     ```

     This opens your editor with a list of commits, e.g.:

     ```bash
     pick abc1234 Initial implementation of module
     pick def5678 Add helper functions
     pick 1234abc Fix edge-case handling
     ```

     Edit the commands to:

     - pick keep a commit as is
     - squash (or s) combine this commit into the previous one
     - reword (or r) change the commit message only
     - edit (or e) pause to amend commit content/message
     - drop (or d) remove a commit entirely

     After saving and closing the editor, follow prompts to resolve any conflicts and run:

     ```bash
     git rebase --continue
     ```

     until the rebase completes.

### 2. Code Style & Standards

- **Documentation**: Document every module, class and function using Google-style docstrings.
- Follow PEP8 Conventions
- **Classes**: Use PascalCase for class names (each word capitalized).
- **Public API functions**: Placed at the top of each module, named in lower_case.
- **Internal functions** (module or class scope): prefixed with a single underscore _internal_function.
- **Private functions** (class-private or special): prefixed with double underscores __private_method.
- **Formatting**: Run formatters and linters before committing:
     ```bash
     pip install black flake8
     black .
     flake8 .
     ```

### 3. Commits

- Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standards
- Format:

     ``` bash
     <type>(<module_or_filename>): <short description>
     ```

     - **type**: feat, fix, hotfix, chore, docs, refactor, release.
     - **scope**: the file or module name (without path separators), in snake_case or PascalCase as it appears in the repo.
     - **description**: a concise summary of what changed.

- Example:

     ```bash
     feat(2_Product_Catalog): initial implementation of Product Catalog page  

     - Configure Streamlit page (title, layout) and enforce user login/sidebar  
     - Load all application data via shared loader  
     - Define DISABLE_CONFIG to conditionally disable country/supplier filters per view  
     - Render one tab per router page with text and multiselect filters (SKU, native family, country, supplier)  
     - Display filtered DataFrames with custom column configuration  
     - Add CSV download with toggle for display-name aliases  
     ```

- After implementing your changes, interactive rebase to squash or split commits so each commit represents one logical change per file:
     ```bash 
     git fetch origin
     git rebase -i origin/main
     ```

### 4. Pull Requests

- Open PRs to `main`
- Provide a clear description of the *what* and *why* of your changes
- Tag at least one reviewer
- Include test steps if relevant

### 5. Testing

- Run all existing pipelines after your change if they’re impacted
- Add or update unit tests for shared utilities or new functionality.
- For Streamlit/webapp changes, mock inputs and validate UI components if applicable.

## Reporting Issues

For bugs, feature suggestions, or pipeline improvements, open an issue using the template provided (if enabled) or contact the maintainer directly.

## Licensing Reminder

All contributions remain under the restricted license terms in `LICENSE.md`. Contributors may retain and reuse their code per the terms specified there.

---

Thanks again for helping maintain a clean, efficient, and well-documented codebase!