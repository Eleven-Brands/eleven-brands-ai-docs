# Local Development Setup

This guide walks you through cloning the repository, configuring Git remotes, and creating a Python virtual environment for working with the Eleven-Brands-Monorepo locally.

## 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/Eleven-Brands/Eleven-Brands-Mainrepo.git
cd Eleven-Brands-Monorepo
```

## 2. Verify Git Remotes

Ensure your origin remote points to the official repo:

```bash
git remote -v
```

Should output:
```bash
origin	git@github.com:Eleven-Brands/Eleven-Brands-Monorepo.git (fetch)
origin	git@github.com:Eleven-Brands/Eleven-Brands-Monorepo.git (push)
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

Run a simple command or tests to confirm everything is working:

```bash
# List available Make targets or run a smoke test
make help
```

```bash
# or run a sample pipeline, if any
python pipelines/sample_pipeline.py
```

You’re now ready to create branches, write code, and follow the CONTRIBUTING guidelines! If you run into issues, please reach out to the project maintainer