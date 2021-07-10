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
let electronWinControlCenter; // our normal electron window with index.html
let electronWinPptr; // the electron window with puppeteer in it (hidden, can be display in settings)
let electronWinA11yTree; // the current a11y tree (hidden, can be displayed in settings)

let pptrPage; // the puppeteer instance

// workaround, we use the internal full AX tree, because it has node IDs
let currentA11yTree;
let currentFocusedOrReadNodeId; // used for both reading and focusing
let currentFocusedElement; 
let currentReadElement; // reading works differently
// let a11yTreeStatic; // for reading actions, old variable
//let a11yTreeCurrentIndex = -1; // currentIndex (reading accessibility tree), used for focusing + reading!

async function initPpptr() {
    // https://github.com/TrevorSundberg/puppeteer-in-electron
    await pie.initialize(app);
    const browser = await pie.connect(app, puppeteer);

    electronWinPptr = new BrowserWindow({
        webPreferences: {
            // security (default values), because it is remote content
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false // TODO: use config option headless/non-headless
    });
    const url = "about:blank"; // TODO: change to about:blank, see docs below
    await electronWinPptr.loadURL(url);

    console.log('MAIN.js', 'initPptr');
    // Given a BrowserWindow, find the corresponding puppeteer Page. It is undefined if external operations occur on the page whilst we are attempting to find it. A url/file must be loaded on the window for it to be found. If no url is loaded, the parameter 'allowBlankNavigate' allows us to load "about:blank" first.
    // https://github.com/TrevorSundberg/puppeteer-in-electron/blob/HEAD/API.md#getpage
    pptrPage = await pie.getPage(browser, electronWinPptr);
    console.log('Page is ' + pptrPage.url());

    saveStaticA11yTree();

    //window.destroy();

    // createWindow if ready;
    createWindow();
    createA11yTreeWindow();

}
initPpptr()

/* workaround https://github.com/puppeteer/puppeteer/issues/3641#issuecomment-655639166 */

/**
 * @param {import("puppeteer").Page} page
 */
function getClient(page) {
    return /** @type {import('puppeteer').CDPSession} */ (
    /** @type {any} */ (page)._client
    )
}

/**
 * @param {import("puppeteer").CDPSession} client
 */
async function getAccessibilityTree(client) {
    return /** @type {import("puppeteer/lib/esm/protocol").default.Accessibility.getFullAXTreeReturnValue} */ (await client.send(
        'Accessibility.getFullAXTree',
    ))
}

/**
 * @param {import("puppeteer").Frame} frame
 * @param {number} backendNodeId
 */
async function resolveNodeFromBackendNodeId(frame, backendNodeId) {
    const ctx = await Promise.resolve(frame.executionContext())
    return /** @type {import('puppeteer').ElementHandle} */ (
    /** @type {any} */ (ctx)._adoptBackendNodeId(backendNodeId)
    )
}
/* eo workaround */

function createWindow() {
    electronWinControlCenter = new BrowserWindow({
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
    //electronWinControlCenter.webContents.openDevTools()

    // control center
    electronWinControlCenter.loadFile('index.html');
}

function createA11yTreeWindow() {
    electronWinA11yTree = new BrowserWindow({
        width: 350,
        height: 350,
        show:false,
        webPreferences: {
            // we activate it because we need access to require electron & ipc
            nodeIntegration: true, // TODO: this is safe because we have no remote content in the index.html/renderer?
            contextIsolation: false, // TODO: see above
            enableRemoteModule: true, // needed for electron-in-page-search
            webViewTag: true //needed for electron-in-page-search
        }
    });
    electronWinA11yTree.loadFile('a11y_tree.html');
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
    //a11yTreeStatic = await pptrPage.accessibility.snapshot();
    //console.log(chalk.green('Current accessibility tree available for navigating/reading:'));
    //console.log(a11yTreeStatic);

    // Workaround:
    const client = getClient(pptrPage);
    currentA11yTree = await getAccessibilityTree(client);
    electronWinA11yTree.webContents.send('updateA11yTree', JSON.stringify(currentA11yTree, null, 2));
}

// https://stackoverflow.com/a/60958198
function findFocusedNode(node) {
    //console.log('checking node',node);
    /*
    // first web area node was also focused, we have to skip it to find real element
    if (node.focused && node.role != 'WebArea') {
        return node;
    }

    for (const child of node.children || []) {
        const focusedNode = findFocusedNode(child);
        if (focusedNode) {
            return focusedNode;
        }
    }*/

    // current workaround, has a little bit different properties
    // tree with child nodes, all on same hierachy
    if(node.properties !== undefined){
        let focusedPropertyObj = node.properties.find(obj => {

            if(obj.name == 'focused'){
                console.log('Checking obj - we found obj with focused',obj);
                console.log('Checking obj - returning', (obj.name == 'focused' && obj.value.value == true))
            }

            return (obj.name == 'focused' && obj.value.value == true);
        });
        // WebArea is always focused in electron, we skip it
        // TODO: find a better way to skip first element? is it always first element
        if (focusedPropertyObj !== undefined){
            console.log('Found focused property object', focusedPropertyObj,'Node:', node);
            if(node.role.value != 'WebArea'){
                console.log('FOUND SOMETHING, RETURNING', node);
                return node;
            }else{
                console.log('Element skipped, it is the parent WebArea of electron', node);
            }
        }
    }

    for (const child of node.nodes || []) {
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
        /*
        //console.log('Creating snapshot of accessibility tree ...');
        let currentSnapshot = await pptrPage.accessibility.snapshot();
        console.log('Current snapshot', currentSnapshot);
        // we need to go into children, because it is in a WebArea on electron, maybe because of pupeteer-electron
        currentElementForOutput = findFocusedNode(currentSnapshot);
        console.log('Current focused element in WebArea:', currentElementForOutput);*/

        // workaround workflow, save current full tree
        await saveStaticA11yTree();
        // set global focused element
        currentFocusedElement = findFocusedNode(currentA11yTree);

        if(currentFocusedElement != undefined){
            // set global node id
            currentFocusedOrReadNodeId = currentFocusedElement.nodeId;
            console.log('Current focused element in WebArea:', currentFocusedElement, 'nodeId',currentFocusedOrReadNodeId);
        
            // set for speech output
            currentElementForOutput = currentFocusedElement;
        }else{
            // no element focused, maybe after page reload
            // TODO: what should we do?
            return false;
        }
    }

    // read action in static copy a11y tree
    // only read if we are not at beginning1
    if (actionType == 'read') {
        // standard accessibility api
        // currentElementForOutput = a11yTreeStatic.children[a11yTreeCurrentIndex];
        // workaround:
        currentElementForOutput = currentReadElement;
        console.log('Current element', currentElementForOutput);
    }

    // TODO: exception if case is not met

    // stop previous output
    say.stop();

    if (currentElementForOutput != undefined) {
        // don't speak role for text
        /*if (currentElementForOutput.role == 'text') {
            currentElementForOutput.role = '';
        }*/

        // deactivated because of workaround
        let description = '';
        // description only exists in some cases
        //let description = (currentElementForOutput.description === undefined) ? "" : currentElementForOutput.description;

        let textToSpeak = currentElementForOutput.role.value + ", " + currentElementForOutput.name.value + ", " + description;

        say.speak(textToSpeak);

        // send text output to browser window (ipc electron)
        electronWinControlCenter.webContents.send('updateScreenreaderOutput', textToSpeak);

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
    electronWinControlCenter.webContents.send('updateScreenreaderOutput', textToSpeak);
});

ipc.on('triggerHeadlessMode', (event, disableHeadless) => {
    if (disableHeadless == true) {
        electronWinPptr.show();
        // TODO: move window next to each other
    } else {
        electronWinPptr.hide();
        electronWinControlCenter.focus();
    }
})

ipc.on('triggerShowHideA11yTree', (event, show) => {
    if (show == true) {
        electronWinA11yTree.show();
        // TODO: move window next to each other
    } else {
        electronWinA11yTree.hide();
    }
});

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
    // reset all global values
    currentReadElement = null;
    currentFocusedOrReadNodeId = null;
    await outputAndSpeakCurrentElement('focus');
});


ipc.on('triggerActionRead', async (event, nextOrPrev) => {

    // for focused elements we just simulate keypress tab, for read we need to go through tree on our own
    // get focused element, read next element in tree
    console.log('Searching for current node id',currentFocusedOrReadNodeId);
    let arrayIndexForCurrentNodeId = currentA11yTree.nodes.findIndex(el => el.nodeId == ''+ currentFocusedOrReadNodeId+'');
    console.log('Index is',arrayIndexForCurrentNodeId);

    if(nextOrPrev == 'next'){
        arrayIndexForCurrentNodeId++;
    }else{
        arrayIndexForCurrentNodeId--;
    }

    // set global vars
    currentReadElement = currentA11yTree.nodes[arrayIndexForCurrentNodeId];
    currentFocusedOrReadNodeId = currentReadElement.nodeId;

    // if it is focusable, focus it
    let focusablePropertyObj = currentReadElement.properties.find(obj => {
        return (obj.name == 'focusable' && obj.value.value == true);
    });
    console.log('focusableProperttyObj',focusablePropertyObj);
    if(focusablePropertyObj != undefined){
        // it's focusable, focus it
        let pptrNode = await resolveNodeFromBackendNodeId(pptrPage.mainFrame(), currentReadElement.backendDOMNodeId);
        console.log('Found node that is focusable, focus it (even) when we read',pptrNode);
        pptrNode.focus(); 
        // this will only be seen in non-headless mode if we don't focus the window shortly (don't know why)
        if(electronWinPptr.isVisible()){
            electronWinPptr.focus();
        }

    }
    // let backendDOMNodeId = 31;
    //const node = await resolveNodeFromBackendNodeId(pptrPage.mainFrame(), backendDOMNodeId);

    /*if (nextOrPrev == 'prev') {
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
            // just for debug, we use the static tree
            let currentSnapshot = await pptrPage.accessibility.snapshot();
            console.log('Current snapshot', currentSnapshot);
        } else {
            console.log(chalk.red('End of tree reached, no more next elements to read.'));
        }
    }*/

    await outputAndSpeakCurrentElement('read');

});

ipc.on('triggerActionStopReading', async (event, args) => {
    say.stop();
});

ipc.on('tryWorkaround', async (event, args) => {

    const util = require('util');
    const fs = require('fs');

    console.log('TRY WORKAROUND');
    const client = getClient(pptrPage);
    const tree = await getAccessibilityTree(client);

    // util.inspect for full output on console
    // util.inspect(tree, {showHidden: false, depth: null}
    fs.writeFile('current_tree.json', JSON.stringify(tree, null, 2), function (err) {
        if (err) return console.log(err);
        console.log('Writing full tree > current_tree.json');
    });

    electronWinA11yTree.webContents.send('updateA11yTree', JSON.stringify(tree, null, 2));

    //console.log('tree',tree);
    //console.log('Single tree element',tree.nodes[0],tree.nodes[0].properties[2]);
    //let backendDOMNodeId = 31;
    //const node = await resolveNodeFromBackendNodeId(pptrPage.mainFrame(), backendDOMNodeId);
    //console.log('NODE',node);


})