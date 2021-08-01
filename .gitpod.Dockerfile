# https://github.com/csweichel/gitpod-hello-ui-demo/blob/master/Dockerfile
# (and https://github.com/JesterOrNot/Gitpod-Electron)
FROM gitpod/workspace-full-vnc

# Bugfix
USER root

# Install dependencies
# added  libnss3 after error (https://community.gitpod.io/t/using-puppeteer-libnss3-no-file-or-directory-issue-on-gitpod/1762/10)
# RUN apt-get update \
#    && apt-get install -y libgtk-3-dev libnss3 \
#    && apt-get clean && rm -rf /var/cache/apt/* && rm -rf /var/lib/apt/lists/* && rm -rf /tmp/*

# Full list of https://github.com/jankeromnes/gitpodPuppeteerTest/blob/master/.gitpod.Dockerfile
RUN sudo apt-get update && \
    sudo apt-get install -y \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils && \
    sudo rm -rf /var/lib/apt/lists/*
