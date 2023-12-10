// ==UserScript==
// @name         Get Booru Tags with Ignore List
// @namespace    https://github.com/vetchems/
// @version      0.4.8
// @description  Press the [~] tilde key under ESC to open a prompt with all tags
// @author       Vetchems
// @match        https://gelbooru.com/index.php?page=post&s=view*
// @match        https://safebooru.donmai.us/posts/*
// @match        https://danbooru.donmai.us/posts/*
// @match        https://aibooru.online/posts/*
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @license MIT

// ==/UserScript==

(function() {
    'use strict';

    // Edit to change default behavior
    let include_commas = true;
    let remove_underscores = true;
    let remove_parentheses = false;
    let randomize_tag_order = false;
    let escape_colons = false;

    // Edit to change tag group order or remove certain groups completely
    let tag_group_order = ["general", "artist"]; // "metadata", "copyright", "character"

    // Edit to change hotkeys
    let hotkey_default = '`';
    let hotkey_1 = '1'; // randomize tags
    let hotkey_clear = '='; // clear tags history

    // Edit to include tags to be ignored
    let tagsToIgnore = ["serafuku", "*school*", "*sailor*", "teenage", "*child*", "*baby*", "*student*", "*loli*", "toddler", "*(cosplay)*", "*teacher*", "siblings", "brother and sister", "*censor*"];

    // Edit to define tag replacements
    let enableTagReplacements = true;

    let tagReplacements = {
        "1girl": "woman",
        "1boy": "man",
        // Add more replacements as needed
    };

    const urlToLoad = 'https://danbooru.donmai.us/posts/random?tags=';

    // Function to handle key press events
    function handleKeyPress(event) {
        // Check if the pressed key is #
        if (event.key === '2') {
            // Prevent the default behavior of the key press (e.g., typing # in an input field)
            event.preventDefault();

            // Load the specified URL in the current tab
            window.location.href = urlToLoad;
        }
        // Check if the pressed key is =
        if (event.key === hotkey_clear) {
            // Prevent the default behavior of the key press
            event.preventDefault();

            // Clear the tags history
            GM_setValue('tagsHistory', '');
            // Inform that the tags history has been cleared
            alert('Tags history has been cleared.');
        }
    }

    // Attach the key press event listener to the document
    document.addEventListener('keydown', handleKeyPress);

    function createTagRegExp(ignoreTag) {
        // Escape special characters in the ignore tag and replace '*' with '.*' for wildcard matching
        const regexPattern = ignoreTag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(regexPattern, 'i'); // 'i' for case-insensitive matching
    }

    function shouldIgnoreTag(tag) {
        return tagsToIgnore.some(ignoreTag => createTagRegExp(ignoreTag).test(tag));
    }

    function replaceTag(tag) {
        return enableTagReplacements && tagReplacements[tag] ? tagReplacements[tag] : tag;
    }

    function randomize_tags(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    let keysPressed = {};

    $(document).on('keyup', (event) => {
        if (event.key == hotkey_default) show_prompt(randomize_tag_order);
        if (event.key == hotkey_1) show_prompt(true);
    });

    $(document).on('keydown', (event) => {
        keysPressed[event.key] = true;
        if (!keysPressed[hotkey_default]) return;
        if (event.key == hotkey_1) show_prompt(true);
    })

    // Constant filename for the text file
    const filename = 'tags_history.txt';

    function show_prompt(randomize=false) {
        for (var member in keysPressed) delete keysPressed[member];

        let tags = null;
        let url = window.location.href;
        if (url.includes("/gelbooru.com"))tags = get_gel_tags(randomize);
        else if (url.includes("/danbooru.donmai.us") || url.includes("/safebooru.donmai.us") || url.includes("/aibooru.online")) tags = get_dan_tags(randomize);
        if (!tags) return;

        // Replace ignored tags
        tags = tags.map(tag => replaceTag(tag));

        // Remove ignored tags
        tags = tags.filter(tag => !shouldIgnoreTag(tag));

        let tag_count = tags.length;

        for (var i = 0; i < tag_count; i++) {
            if (remove_underscores) tags[i] = tags[i].replaceAll("_", " ");
            else tags[i] = tags[i].replaceAll(" ", "_");
        }

        tags = tags.join(", ");
        if (!include_commas) tags = tags.replaceAll(",", "");
        if (escape_colons) tags = tags.replaceAll(":", ":\\");
        if (remove_parentheses) tags = tags.replaceAll("(", "").replaceAll(")", "");
        else tags = tags.replaceAll("(", "\\(").replaceAll(")", "\\)");

        // Copy tags to the clipboard
        GM_setClipboard(tags);

        // Append the new set of tags to the text file
        appendTagsToFile(tags);
    }

    function appendTagsToFile(newTags) {
        // Retrieve the existing content of the file
        const existingContent = GM_getValue('tagsHistory', '');

        // Combine the existing content with the new tags on a new line
        const updatedContent = existingContent + (existingContent ? '\n' : '') + newTags;

        // Save the updated content to the file
        GM_setValue('tagsHistory', updatedContent);
    }

    function downloadTagsHistory() {
        // Retrieve the content from storage
        const tagsHistory = GM_getValue('tagsHistory', '');

        // Save the content as a file using GM_download
        GM_download({
            blob: new Blob([tagsHistory], { type: 'text/plain' }),
            name: filename,
            url: URL.createObjectURL(new Blob([tagsHistory], { type: 'text/plain' })),
            saveAs: true,
        });
    }

    // Event listener for the keydown event
    $(document).on('keydown', (event) => {
        keysPressed[event.key] = true;
        if (event.key == '4') downloadTagsHistory();
    });

    function get_gel_tags(randomize=false) {
        let tags = [];
        for (let group of tag_group_order) {
            let group_tags = [];
            for (let e of document.getElementsByClassName("tag-type-"+group)) group_tags.push(e.children[1].textContent);
            if (randomize) randomize_tags(group_tags);
            tags = tags.concat(group_tags);
        }
        return tags;
    }

    function get_dan_tags(randomize=false) {
        let tags = [];
        for (let group of tag_group_order) {
            group = ((group == "metadata") ? "meta" : group);
            let group_tags = [];
            for (let e of document.getElementsByClassName(group+"-tag-list")) {
                if (e.tagName != "UL") continue;
                for (let te of e.getElementsByClassName("search-tag")) group_tags.push(te.textContent);
            }
            if (randomize) randomize_tags(group_tags);
            tags = tags.concat(group_tags);
        }
        return tags;
    }

})();
