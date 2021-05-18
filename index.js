// automatically pick platform
const say = require('say');
const readlineSync = require('readline-sync');
const chalk = require('chalk');

// https://stackoverflow.com/a/60958198
function findFocusedNode(node) {
    if (node.focused) {
        return node;
    }

    for (const child of node.children || []) {
        const focusedNode = findFocusedNode(child);
        if (focusedNode) {
            return focusedNode;
        }
    }
}

// Minimal puppeteer example
const puppeteer = require('puppeteer');
(async () => {
    // use headless:false for debugging, it'll show browser window
    // TODO: add flag for it
    const headless = true;
    const browser = await puppeteer.launch({
        headless: headless,
        defaultViewport: {
            width: 800,
            height: 720
        }
    });
    const page = await browser.newPage();

    var cliArgs = process.argv.slice(2);
    console.log('cli args given: ', cliArgs);

    let url;
    if(cliArgs[0] != undefined){
       url = cliArgs[0];
    }
    else{
        // default example
        url = 'https://dequeuniversity.com/library/aria/simple-dialog';
    }

    console.log('Opening '+url+" ...");
    await page.goto(url, {
        waitUntil: 'domcontentloaded'
    });

    let pageTitle = await page.title();
    say.speak(pageTitle);

    // create static tree for reading out elements
    // unfortunately there is no reference yet, therefore we can't just enter on clickable items, see:
    // https://github.com/puppeteer/puppeteer/issues/3641
    let a11yTreeStatic = await page.accessibility.snapshot();
    console.log(chalk.green('Current accessibility tree available for navigating/reading:'));
    console.log(a11yTreeStatic);
    let a11yTreeCurrentIndex = -1; // currentIndex (reading accessibility tree)

    let stop = false;

    while (stop == false) {
        
        console.log(" ");
        
        //console.log(chalk.yellow('************ MENU ***************'));
        navigationOptions = ['Tab forward (focusable)', 'Tab backward (focusable)','Press Enter (focusable)','---------------', 'Read (next)', 'Read previous','---------------', 'Print current tree'],
        index = readlineSync.keyInSelect(navigationOptions, chalk.yellow('What do you want to do next?'));
        //console.log('index', index);
        if (index == -1) {
            stop = true; // break the loop
            break;
        }

        console.log(" ");

        switch (index) {
            case 0:
                console.log(chalk.green('Tab forward...'));
                await page.keyboard.press("Tab");
                break;
            case 1:
                console.log(chalk.green('Tab backward ...'));
                await page.keyboard.down('Shift');
                await page.keyboard.press("Tab");
                await page.keyboard.up('Shift');
                break;
            case 2:
                // TODO: only allow enter if there is a focused node
                var currenta11yTree = await page.accessibility.snapshot();
                if(findFocusedNode(currenta11yTree)!= undefined){
                    console.log(chalk.green('Press Enter ... (focusable)'));
                    await page.keyboard.press("Enter");
                    // we could end up in another context, therefore we replace the the a11y tree
                    a11yTreeStatic = await page.accessibility.snapshot();
                    console.log(chalk.yellow('The a11y tree may have changed, current tree:'));
                    console.log(a11yTreeStatic);
                    a11yTreeCurrentIndex = -1; // set index back to start value
                }
                // does not work
                /*else if(a11yTreeCurrentIndex >= 0){
                    // if we have readable items, try to find them by name
                    // (unfortunately there is no id given by now)
                    let nameCurrentReadEl = a11yTreeStatic.children[a11yTreeCurrentIndex].name;
                    await page.focus("[name='"+nameCurrentReadEl+"']");
                    a11yTreeStatic = await page.accessibility.snapshot();
                    console.log(a11yTreeStatic);
                }*/
                else{
                    console.log(chalk.red('No element focussed, we can\'t press enter'));
                }
                
                break;
            case 4:
                // TODO: jump to next node in accessibilty tree, read it
                if((a11yTreeCurrentIndex + 1) < a11yTreeStatic.children.length){
                    a11yTreeCurrentIndex++;
                    console.log(chalk.green('Select next ...'));
                }else{
                    console.log(chalk.red('End of tree reached, no more next elements to read.'));
                }
                break;
            case 5:
                // TODO: jump to previous in accessibility tree, read it
                if((a11yTreeCurrentIndex - 1) >= 0){
                    console.log(chalk.green('Select prev ...'));
                    a11yTreeCurrentIndex--;
                }else{
                    console.log(chalk.red('Start of tree reached, no more prev elements to read.'));
                }
                break;
            case 7:
                console.log(chalk.green('Current tree:'));
                var currenta11yTree = await page.accessibility.snapshot();
                console.log(currenta11yTree);
                break;
        }

        let currentElementForOutput;

        // tab actions (focusable elements)
        if (index == 0 || index == 1) {
            //console.log('Creating snapshot of accessibility tree ...');
            let currentSnapshot = await page.accessibility.snapshot();
            currentElementForOutput = findFocusedNode(currentSnapshot);
            console.log('Current focused element:', currentElementForOutput);
        }

        // read action in static copy a11y tree
        // only read if we are not at beginning1
        if (index == 4 || index == 5) {
            currentElementForOutput = a11yTreeStatic.children[a11yTreeCurrentIndex];
            console.log('Current element', currentElementForOutput);
        }

        // stop previous output
        say.stop();

        // read items in tree after enter action
        if(index == 2){
            say.speak("Current items available in tree: "+a11yTreeStatic.children.length);
        }

        if(currentElementForOutput != undefined){
             // don't speak role for text
            if(currentElementForOutput.role == 'text'){
                currentElementForOutput.role = '';
            }

            // description only exists in some cases
            let description = (currentElementForOutput.description === undefined) ? "" : currentElementForOutput.description;
            say.speak(currentElementForOutput.role + ", " + currentElementForOutput.name + ", " + description);
        }

       

        //let activeEl = await page.evaluateHandle(() => document.activeElement);
        //console.log("Active element:",activeEl);
    }

    //console.log(snapshot);
    /*for(let i = 0; i < 10; i++){
      await say.speak("Role: "+snapshot.children[i].role+" "+snapshot.children[i].name);
    }*/

    // Cleanup
    await browser.close();


})();