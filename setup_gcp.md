# Installing and Connecting to Google Cloud

## 1. Install Google Cloud SDK (CLI Tools)

1. Download the official installer:  
     https://cloud.google.com/sdk/docs/install

2. Run the installer and follow these steps:
     - Click **Next** on the welcome screen (no checkboxes needed)  
     - Accept the license agreement (**I Agree**)  
     - Choose **Install for All Users**, then click *Next*  
     - Select the installation directory  
     - On the components screen, **select all except “Beta Commands”**  
     - Click **Install** and wait for completion  
     - On the final screen, uncheck:  
          - “Start Google Cloud SDK Shell”  
          - “Run ‘gcloud init’ to configure the Google Cloud CLI”  

3. After installation, open a terminal and verify the tools:

```bash
gcloud version
bq version
gsutil version
```


### 2. Authenticate & Configure

Run the initialization command:

```bash
gcloud init
```

- Type 1 to reinitialize the current configuration
- Pick your account
- Choose the appropriate GCP project
- When asked about region/zone, just type n to skip

Confirm your project is active:

```bash
gcloud projects list
```

## 3. Set Up VS Code for GCP

Install the Cloud Code Extension  
  - Open VS Code  
  - Go to Extensions (`Ctrl+Shift+X`)  
  - Search for **Google Cloud Code** and install it  
  - A new Cloud icon should appear in the sidebar  

You can now browse GCP resources inside VS Code  

## 4. Connect VS Code to Your GCP Account

1. At the bottom of the VS Code window, click **Cloud Code – Sign In**  
2. Choose **“Sign in to Google Cloud”**  
3. Your browser will open for OAuth login  
4. Select your GCP account and approve permissions  
5. Return to VS Code — you should now see your account and active project in the status bar  
