const { app, BrowserWindow } = require('electron')
const path = require('path')
const electron = require('electron'),
    ipc = electron.ipcMain;
const pie = require("puppeteer-in-electron")
const puppeteer = require("puppeteer-core");
const chalk = require('chalk');
const say = require('say');
const { create } = require('domain');

// global vars
let controlCenterWindow; // our normal electron window with index.html
let pptrWindow; // the electron window with puppeteer in it
let pptrPage;
let a11yTreeStatic; // for reading actions
let a11yTreeCurrentIndex = -1; // currentIndex (reading accessibility tree)

async function initPpptr() {
    // https://github.com/TrevorSundberg/puppeteer-in-electron
    await pie.initialize(app);
    const browser = await pie.connect(app, puppeteer);

    pptrWindow = new BrowserWindow({
        webPreferences: {
            // security (default values), because it is remote content
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false // TODO: use config option headless/non-headless
    });
    const url = "https://brave.com/search/"; // TODO: change to about:blank, see docs below
    await pptrWindow.loadURL(url);

    console.log('MAIN.js', 'initPptr');
    // Given a BrowserWindow, find the corresponding puppeteer Page. It is undefined if external operations occur on the page whilst we are attempting to find it. A url/file must be loaded on the window for it to be found. If no url is loaded, the parameter 'allowBlankNavigate' allows us to load "about:blank" first.
    // https://github.com/TrevorSundberg/puppeteer-in-electron/blob/HEAD/API.md#getpage
    pptrPage = await pie.getPage(browser, pptrWindow);
    console.log('Page is ' + pptrPage.url());

    saveStaticA11yTree();

    //window.destroy();

    // createWindow if ready;
    createWindow();
}
initPpptr()

function createWindow() {
    controlCenterWindow = new BrowserWindow({
        width: 800,
        height: 750,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // we activate it because we need access to require electron & ipc
            nodeIntegration: true, // TODO: this is safe because we have no remote content in the index.html/renderer?
            contextIsolation: false // TODO: see above
        }
    });
    // TODO: add debug var
    //controlCenterWindow.webContents.openDevTools()

    // control center
    controlCenterWindow.loadFile('index.html');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

    //createWindow();

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) initPpptr()
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

/* 
* general methods
* TODO: move to own class
*/

async function saveStaticA11yTree() {
    // create static tree for reading out elements
    // unfortunately there is no reference yet, therefore we can't just enter on clickable items, see:
    // https://github.com/puppeteer/puppeteer/issues/3641
    a11yTreeStatic = await pptrPage.accessibility.snapshot();
    console.log(chalk.green('Current accessibility tree available for navigating/reading:'));
    console.log(a11yTreeStatic);
}

// https://stackoverflow.com/a/60958198
function findFocusedNode(node) {
    // first web area node was also focused, we have to skip it to find real element
    if (node.focused && node.role != 'WebArea') {
        return node;
    }

    for (const child of node.children || []) {
        const focusedNode = findFocusedNode(child);
        if (focusedNode) {
            return focusedNode;
        }
    }
}


async function outputAndSpeakCurrentElement(actionType) {

    let currentElementForOutput;

    // tab actions (focusable elements)
    if (actionType == 'focus') {
        //console.log('Creating snapshot of accessibility tree ...');
        let currentSnapshot = await pptrPage.accessibility.snapshot();
        console.log('Current snapshot', currentSnapshot);
        // we need to go into children, because it is in a WebArea on electron, maybe because of pupeteer-electron
        currentElementForOutput = findFocusedNode(currentSnapshot);
        console.log('Current focused element in WebArea:', currentElementForOutput);
    }

    // read action in static copy a11y tree
    // only read if we are not at beginning1
    if (actionType == 'read') {
        currentElementForOutput = a11yTreeStatic.children[a11yTreeCurrentIndex];
        console.log('Current element', currentElementForOutput);
    }

    // TODO: exception if case is not met

    // stop previous output
    say.stop();

    if (currentElementForOutput != undefined) {
        // don't speak role for text
        if (currentElementForOutput.role == 'text') {
            currentElementForOutput.role = '';
        }

        // description only exists in some cases
        let description = (currentElementForOutput.description === undefined) ? "" : currentElementForOutput.description;

        let textToSpeak = currentElementForOutput.role + ", " + currentElementForOutput.name + ", " + description;

        say.speak(textToSpeak);

        // send text output to browser window (ipc electron)
        controlCenterWindow.webContents.send('updateScreenreaderOutput', textToSpeak);

    }



}


/*
* Receive and reply to asynchronous message
*/
ipc.on('openWebsite', async (event, args) => {
    console.log('MAIN.JS', 'Received:', 'openWebsite', args);
    await pptrPage.goto(args.url);

    saveStaticA11yTree();

    let pageTitle = await pptrPage.title();
    let textToSpeak = 'Page title is: ' + pageTitle;
    say.speak(textToSpeak);
    // send to child process
    controlCenterWindow.webContents.send('updateScreenreaderOutput', textToSpeak);
});

ipc.on('triggerHeadlessMode', (event,disableHeadless)=>{
    if(disableHeadless == true){
        pptrWindow.show();
        // TODO: move window next to each other
    }else{
        pptrWindow.hide();
        controlCenterWindow.focus();
    }
})

ipc.on('triggerActionFocus', async (event, nextOrPrev) => {

    if (nextOrPrev == 'prev') {
        console.log(chalk.green('Tab backward ...'));
        await pptrPage.keyboard.down('Shift');
        await pptrPage.keyboard.press("Tab");
        await pptrPage.keyboard.up('Shift');
    } else {
        console.log(chalk.green('Tab forward ...'));
        await pptrPage.keyboard.press("Tab");
    }

    await outputAndSpeakCurrentElement('focus');

});

ipc.on('triggerActionEnter', async (event, args) => {
    console.log(chalk.green('Enter...'));
    await pptrPage.keyboard.press("Enter");
    await outputAndSpeakCurrentElement('focus');
});


ipc.on('triggerActionRead', async (event, nextOrPrev) => {

    if (nextOrPrev == 'prev') {
        // TODO: jump to previous in accessibility tree, read it
        if ((a11yTreeCurrentIndex - 1) >= 0) {
            console.log(chalk.green('Select prev ...'));
            a11yTreeCurrentIndex--;
        } else {
            console.log(chalk.red('Start of tree reached, no more prev elements to read.'));
        }
    } else {
        // TODO: jump to next node in accessibilty tree, read it
        if ((a11yTreeCurrentIndex + 1) < a11yTreeStatic.children.length) {
            a11yTreeCurrentIndex++;
            console.log(chalk.green('Select next ...'));
        } else {
            console.log(chalk.red('End of tree reached, no more next elements to read.'));
        }
    }

    await outputAndSpeakCurrentElement('read');

});

ipc.on('triggerActionStopReading', async (event, args) => {
    say.stop();
});
