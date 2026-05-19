# Local Development Setup

This guide walks you through cloning a repository, configuring Git remotes, and creating a Python virtual environment. Each Eleven Brands repo follows the same setup process — just substitute the repo name where indicated.

## 1. Clone the Repository

```bash
# Replace <repo-name> with the target repo, e.g. eleven-brands-bigquery-ingestion
git clone https://github.com/Eleven-Brands/<repo-name>.git
cd <repo-name>
```

## 2. Verify Git Remotes

Ensure your origin remote points to the official repo:

```bash
git remote -v
```

Should output:
```bash
origin	git@github.com:Eleven-Brands/<repo-name>.git (fetch)
origin	git@github.com:Eleven-Brands/<repo-name>.git (push)
```

## 3. Initialize Your Local Git Environment

Ensure your Git identity is configured:

```bash
git config --list
```

If needed, set your name and email:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 4. Create & Activate a Python Virtual Environment

All Python dependencies are managed via requirements.txt. To isolate your environment:

```bash
# Create a virtual environment in .venv
python3 -m venv .venv

# Activate it:
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate
```

## 5. Install Dependencies

With the virtual environment active, install required packages:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 6. Verify Your Setup

Run a quick check to confirm everything is working. The exact command depends on the repo — refer to its README for specifics. Common examples:

```bash
# Python repos: run the test suite
pytest -q

# Or verify the main entry point imports correctly
python -c "import <main_module>"
```

You’re now ready to create branches, write code, and follow the CONTRIBUTING guidelines! If you run into issues, please reach out to the project maintainer.