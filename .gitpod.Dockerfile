# https://github.com/csweichel/gitpod-hello-ui-demo/blob/master/Dockerfile
# (and https://github.com/JesterOrNot/Gitpod-Electron)
FROM gitpod/workspace-full-vnc

# Bugfix
USER root

# Install dependencies
# added  libnss3 after error (https://community.gitpod.io/t/using-puppeteer-libnss3-no-file-or-directory-issue-on-gitpod/1762/10)
RUN apt-get update \
    && apt-get install -y libgtk-3-dev libnss3 \
    && apt-get clean && rm -rf /var/cache/apt/* && rm -rf /var/lib/apt/lists/* && rm -rf /tmp/*
