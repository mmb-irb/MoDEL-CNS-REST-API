// Running in a worker
// POSSIBLE ERROR: Cannot find module 'worker_threads'
// Node must be version 11 or higher.
const { isMainThread, parentPort } = require('worker_threads');

// This should never be true as this is expected to run on a worker thread
if (isMainThread) throw new Error("This shouldn't run in the main thread!");

/**
 * Doing all sort of global stuff here, which is why we're running that in a
 * worker thread, so that it might not affect anything else
 */
// if we hadn't done so before...
if (!global.window) {
  // get a fake DOM from jsdom
  const dom = new (require('jsdom').JSDOM)();
  // put on the global object all the things NGL expects
  global.window = dom.window;
  global.Blob = dom.window.Blob;
  global.File = dom.window.File;
  global.FileReader = dom.window.FileReader;
}

// Now that we're good, load ngl
const ngl = require('ngl');
// HTTP response standard codes
const { BAD_REQUEST } = require('../status-codes');

/**
 * This is the main part of the worker's logic
 *
 * @param {Buffer} pdbFile - Buffer containing the PDB reference file content
 * @param {string} selection - NGL-formatted selection (see http://nglviewer.org/ngl/api/manual/usage/selection-language.html)
 * @returns {string} Atom ranges, not collapsed, in a HTTP Range header format
 */
const main = async (pdbFile, selection) => {
  // Save the pdbFile as a Blob (Binary large object), which is a format for storing data
  const structure = await ngl.autoLoad(new global.Blob([pdbFile]), { ext: 'pdb' });
  // Parse the whole structure to pdb file
  // WARNING: Apparently there is no way to filter the structure before passing it to pdb writer
  const pdb = new ngl.PdbWriter(structure);
  const pdbLines = pdb.getString().split('\n');
  // Set an array where pdb lines from selected atoms will be pushed
  // Add the pdb header by now
  const filteredPdbLines = [pdbLines[0]];
  // Save the selection in ngl format (structureComponent)
  const sel = new ngl.Selection(selection);
  // Save the data from structure which corresponds to the selection atoms
  const view = structure.getView(sel);
  // If the selection is empty then return an error instead of an empty pdb file
  if (view.atomCount === 0) return {
    headerError: BAD_REQUEST,
    error: `Empty atom selection for "${selection}"`
  }
  // Add the pdb line for each corresponding filtered atom to the new filtered pdb lines
  // The +2 goes for the innate pdb headers: 'TITEL' and 'MODEL 1'
  view.eachAtom(({ index }) => filteredPdbLines.push(pdbLines[index + 2]));
  // Join all lines back to a single string and return it
  const filteredPdb = filteredPdbLines.join('\n');
  return filteredPdb;
};

// Main thread <=> worker thread communication
parentPort.addListener('message', async message => {
  // The first message we receive should be of type 'init'
  if (message.type !== 'init') throw new Error('not a supported message');
  try {
    // Try to send data
    const output = await main(message.file, message.selection);
    parentPort.postMessage({ type: 'success', data: output });
  } catch (error) {
    parentPort.postMessage({ type: 'error', error });
  }
});
