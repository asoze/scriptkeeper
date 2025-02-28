// Access form elements
const scriptForm = $("#scriptForm");
const scriptFileInput = $("#scriptFile");
const characterSelect = $("#characterSelect");
const extractedTextContainer = $("#extractPane");

const characterNames = [];
const parentheticals = [];
const sceneHeadings = [];
const dialogs = [];

// Handle form submission
scriptForm.on("submit", async function (e) {
  e.preventDefault();

  const file = scriptFileInput[0].files[0];
  if (!file) {
    alert("Please select a PDF file.");
    return;
  }

  // const selectedCharacter = characterSelect.val();
  // if (!selectedCharacter) {
  //   alert("Please select your character.");
  //   return;
  // }
  const selectedCharacter = "Artie";

  // Read the PDF file as an ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Use PDF.js to load the document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let extractedText = "";

  // Extract Text with Formatting
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by their vertical position (i.e., line by line)
    const lines = [];
    let lastY = -1;
    let currentLine = [];

    textContent.items.forEach((item) => {
      const transform = item.transform;
      const x = transform[4];
      const y = transform[5];

      // Check if we're still on the same line
      if (Math.abs(y - lastY) > 2) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [];
        }
      }
      currentLine.push({ text: item.str, x });
      lastY = y;
    });

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    lines.forEach((line) => {
      line.sort((a, b) => a.x - b.x);
      const lineText = line.map((item) => item.text).join(" ");
      extractedText += lineText + "\n";
    });
  }

  const cleanText = cleanExtractedText(extractedText);
  const textWithNames = identifyCharacterNames(cleanText);
  const headingsWithNames = identifySceneHeadings(textWithNames);
  const parens = identifyParentheticals(headingsWithNames);
  const withDialogue = identifyDialogue(parens);
  const withAction = identifyAction(withDialogue);
  const finale = consolidateElements(withAction);

  // Display extracted text
  extractedTextContainer.html(finale);
});

const cleanExtractedText = (text) => {
  // Step 1: Split text into lines
  const lines = text.split("\n");

  // Step 2: Clean each line individually
  const cleanedLines = lines.map((line) => {
    // Remove spaces between letters but not within words
    line = line.replace(/(\w)\s(?=\w)/g, "$1");

    // Collapse multiple spaces into one, but preserve leading indentation
    line = line.replace(/(\S)\s{2,}/g, "$1 ");

    // Preserve leading spaces (indentation) for formatting
    line = line.replace(/^\s+/, (match) => match);

    // NEW: Remove spaces before periods
    line = line.replace(/\s+(\.)/g, "$1");

    return line;
  });

  // Step 3: Join lines back together
  return cleanedLines.join("\n");
};

const identifyCharacterNames = (text) => {
  const lines = text.split("\n");
  const identifiedLines = lines.map((line, index) => {
    // Regex to detect character names
    const isCharacterName = /^[A-Z0-9\- ]{2,30}$/.test(line.trim());

    const nextLineIndented =
      lines[index + 1] && lines[index + 1].startsWith(" ");

    // Confirm it's a character name if it's followed by an indented dialogue line
    if (isCharacterName && nextLineIndented) {
      characterNames.push(line.trim());
      return `<span class="character-name">${line.trim()}</span>`;
    }
    return line;
  });

  return identifiedLines.join("\n");
};

const identifySceneHeadings = (text) => {
  const lines = text.split("\n");
  const identifiedLines = lines.map((line, index) => {
    // Enhanced regex to detect scene headings
    const isSceneHeading =
      /^(INT\.|EXT\.|INT\/EXT\.)\s+[A-Z0-9\s\-]+(?:\s+\-\s+[A-Z0-9\s\-]+)*$/.test(
        line.trim(),
      );
    const isLeftAligned = !line.startsWith(" "); // Left-aligned check
    // Confirm it's a scene heading if it's left-aligned
    if (isSceneHeading && isLeftAligned) {
      return `<span class="scene-heading">${line.trim()}</span>`;
    }
    return line;
  });

  return identifiedLines.join("\n");
};

const identifyParentheticals = (text) => {
  const lines = text.split("\n");
  const identifiedLines = lines.map((line, index) => {
    // Enhanced regex to detect parentheticals with optional spaces and complex content
    const isParenthetical = /^\s*\(\s*[a-zA-Z0-9\s\-.,!?']+\s*\)\s*$/.test(
      line,
    );

    // Check the previous three lines for a character name (allowing for blank lines and slight indentation)
    const isUnderCharacterName =
      (index > 0 && /^\s{0,2}[A-Z0-9\- ]{2,30}$/.test(lines[index - 1])) ||
      (index > 1 && /^\s{0,2}[A-Z0-9\- ]{2,30}$/.test(lines[index - 2])) ||
      (index > 2 && /^\s{0,2}[A-Z0-9\- ]{2,30}$/.test(lines[index - 3]));

    // Check for dialogue either on the next line or the line after (to allow wrapping)
    const isAboveDialogue =
      (lines[index + 1] && lines[index + 1].trim().length > 0) ||
      (lines[index + 2] && lines[index + 2].trim().length > 0);

    if (isParenthetical) {
      console.log("UNDER", isUnderCharacterName);
      console.log("ABOVE", isAboveDialogue);
    }

    // Confirm it's a parenthetical based on position
    if (isParenthetical && isAboveDialogue) {
      //isUnderCharacterName && isAboveDialogue) {
      return `<span class="parenthetical">${line.trim()}</span>`;
    }
    return line;
  });

  return identifiedLines.join("\n");
};

const identifyDialogue = (text) => {
  const lines = text.split("\n");
  let inDialogueBlock = false;
  const identifiedLines = lines.map((line) => {
    const trimmed = line.trim();

    // Reset dialogue block on empty line
    if (trimmed === "") {
      inDialogueBlock = false;
      return line;
    }

    // If this line contains a scene heading, it's not dialogue.
    if (line.indexOf('class="scene-heading"') !== -1) {
      inDialogueBlock = false;
      return line;
    }

    // If this line contains a character name, start a dialogue block.
    if (line.indexOf('class="character-name"') !== -1) {
      inDialogueBlock = true;
      return line;
    }

    // If this line contains a parenthetical, it’s part of dialogue.
    if (line.indexOf('class="parenthetical"') !== -1) {
      inDialogueBlock = true;
      return line;
    }

    // If we're in a dialogue block, wrap the line in a dialogue tag.
    if (inDialogueBlock) {
      return `<span class="dialogue">${trimmed}</span>`;
    }

    // Otherwise, leave the line as-is.
    return line;
  });
  return identifiedLines.join("\n");
};

// IdentifyAction() just wraps everything that's left. This is NOT a great way to do this, but... eh.
const identifyAction = (text) => {
  const lines = text.split("\n");
  const identifiedLines = lines.map((line) => {
    // If the line already contains one of our markers, leave it unchanged.
    if (
      line.indexOf('class="scene-heading"') !== -1 ||
      line.indexOf('class="character-name"') !== -1 ||
      line.indexOf('class="parenthetical"') !== -1 ||
      line.indexOf('class="dialogue"') !== -1
    ) {
      return line;
    }
    // Skip blank lines.
    if (line.trim() === "") return line;

    // Check for left-alignment. We assume action lines have little to no indentation.
    const leadingSpaces = (line.match(/^\s*/) || [""])[0].length;
    if (leadingSpaces <= 2) {
      // Wrap the trimmed line in an action tag.
      return `<span class="action">${line.trim()}</span>`;
    }
    // Otherwise, leave it unchanged.
    return line;
  });
  return identifiedLines.join("\n");
};

const consolidateElements = (text) => {
  // Split the text by newlines.
  const lines = text.split("\n");
  const consolidated = [];
  let currentBlockType = null;
  let currentBlockContent = [];

  // Helper to flush the current block if it exists.
  const flushCurrentBlock = () => {
    if (currentBlockType && currentBlockContent.length > 0) {
      // Combine the accumulated lines with a space (or a newline if you prefer).
      const combinedText = currentBlockContent.join(" ");
      // Wrap the combined text in the appropriate tag.
      consolidated.push(
        `<span class="${currentBlockType}">${combinedText}</span>`,
      );
    }
    currentBlockType = null;
    currentBlockContent = [];
  };

  // Iterate through each line.
  lines.forEach((line) => {
    // Check if the line is a dialogue line.
    if (line.indexOf('class="dialogue"') !== -1) {
      // If we are already in a dialogue block, append its inner text.
      if (currentBlockType === "dialogue") {
        const innerText = line.replace(/<[^>]+>/g, "").trim();
        currentBlockContent.push(innerText);
      } else {
        // Flush any previous block and start a new dialogue block.
        flushCurrentBlock();
        currentBlockType = "dialogue";
        const innerText = line.replace(/<[^>]+>/g, "").trim();
        currentBlockContent.push(innerText);
      }
    }
    // Check if the line is an action line.
    else if (line.indexOf('class="action"') !== -1) {
      if (currentBlockType === "action") {
        const innerText = line.replace(/<[^>]+>/g, "").trim();
        currentBlockContent.push(innerText);
      } else {
        flushCurrentBlock();
        currentBlockType = "action";
        const innerText = line.replace(/<[^>]+>/g, "").trim();
        currentBlockContent.push(innerText);
      }
    }
    // For any other line, flush the current block and output the line as-is.
    else {
      flushCurrentBlock();
      consolidated.push(line);
    }
  });

  // Flush any remaining block.
  flushCurrentBlock();

  return consolidated.join("\n");
};

// Example function to build a JSON structure from your tagged HTML output.
// This should be customized to match the markup you created.
function buildScreenplayJSON() {
  const screenplay = { scenes: [] };
  let currentScene = null;
  let currentDialogue = null;

  // We assume your final consolidated HTML is stored in a <pre> with id "extractPane"
  // and each line is separated by newline characters.
  const rawHTML = $("#extractPane").html();
  const lines = rawHTML.split("\n");

  lines.forEach((rawLine) => {
    // Create a temporary element to parse HTML content in the line.
    const $line = $("<div>" + rawLine + "</div>");
    const lineText = $line.text().trim();

    // Skip empty lines
    if (!lineText) return;

    // Scene Heading
    if ($line.find(".scene-heading").length > 0) {
      // If we have an existing scene, push it.
      if (currentScene) screenplay.scenes.push(currentScene);
      currentScene = { heading: lineText, elements: [] };
      currentDialogue = null;
      return;
    }

    // Character Name
    if ($line.find(".character-name").length > 0) {
      // Start a new dialogue block.
      currentDialogue = {
        character: lineText,
        parenthetical: null,
        dialogue: "",
      };
      if (currentScene) {
        currentScene.elements.push({ type: "dialogue", data: currentDialogue });
      }
      return;
    }

    // Parenthetical
    if ($line.find(".parenthetical").length > 0) {
      if (currentDialogue) {
        currentDialogue.parenthetical = lineText;
      }
      return;
    }

    // Dialogue or Action
    // If there's an active dialogue block, assume the line is dialogue continuation.
    if (currentDialogue) {
      currentDialogue.dialogue +=
        (currentDialogue.dialogue ? " " : "") + lineText;
    } else if (currentScene) {
      // Otherwise, treat it as an action element.
      currentScene.elements.push({ type: "action", content: lineText });
    }
  });

  // Push the final scene if it exists.
  if (currentScene) screenplay.scenes.push(currentScene);
  return screenplay;
}

// Function to export a JSON object to a file.
function exportToJson() {
  // Build the JSON document from your tagged text.
  const screenplayJSON = buildScreenplayJSON();
  // Convert the JSON object to a string.
  const jsonString = JSON.stringify(screenplayJSON, null, 2);

  // Create a Blob from the JSON string.
  const blob = new Blob([jsonString], { type: "application/json" });
  // Generate a temporary URL for the Blob.
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor element.
  const a = document.createElement("a");
  a.href = url;
  a.download = "screenplay.json"; // Filename for the downloaded JSON file.

  // Append the anchor, trigger the download, and remove the anchor.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke the Blob URL.
  URL.revokeObjectURL(url);
}

// Example usage: attach the exportToJson function to a button click.
$("#exportBtn").on("click", exportToJson);
