const Router = require('express').Router;
// A standard request and response handler used widely in most endpoints
const handler = require('../../../utils/generic-handler');
// Get the database handler
const getDatabase = require('../../../database');
// Standard HTTP response status codes
const { BAD_REQUEST } = require('../../../utils/status-codes');
// Set a error-proof JSON parser
const { parseJSON } = require('../../../utils/auxiliar-functions');
// Import references configuration
const { REFERENCES, REFERENCE_HEADER } = require('../../../utils/constants');

const router = Router({ mergeParams: true });

// This endpoint returns some summary of data contained in the projects collection
router.route('/').get(
  handler({
    async retriever(request) {
      // Stablish database connection and retrieve our custom handler
      const database = await getDatabase(request);
      // Set an object with all the parameters to performe the mongo query
      // Start filtering by published projects only if we are in production environment
      const finder = database.getBaseFilter();
      // Handle when there is a mongo query
      let query = request.query.query;
      if (query) {
        // In case there is a single query it would be a string, not an array, so adapt it
        if (typeof query === 'string') query = [query];
        for (const q of query) {
          // Parse the string into an object
          const projectsQuery = parseJSON(q);
          // If something went wrong with the parsing then it means the query is wrong
          // Send an error
          if (!projectsQuery) return {
            headerError: BAD_REQUEST,
            error: 'Wrong query syntax: ' + q
          };
          // At this point the query object should correspond to a mongo query itself
          // Find fields which start with 'references'
          // These fields are actually intended to query references collections
          // If we found references fields then we must query the references collection
          // Then each references field will be replaced by its corresponding project field in a new query
          // e.g. references.proteins -> metadata.REFERENCES
          // e.g. references.ligands -> metadata.LIGANDS
          const parseReferencesQuery = async originalQuery => {
            // Iterate over the original query fields
            for (const [field, value] of Object.entries(originalQuery)) {
              // If the field is actually a list of fields then run the parsing function recursively
              if (field === '$and' || field === '$or') {
                for (const subquery of value) {
                  await parseReferencesQuery(subquery);
                }
                return;
              }
              // If the field does not start with the references header then skip it
              if (!field.startsWith(REFERENCE_HEADER)) return;
              // Get the name of the field and the reference collection
              const fieldSplits = field.split('.');
              const referenceName = fieldSplits[1];
              const referenceField = fieldSplits[2];
              // Get the reference configuration
              const reference = REFERENCES[referenceName];
              // Set the references query
              const referencesQuery = {};
              referencesQuery[referenceField] = value;
              // Set the reference projector
              const referencesProjector = { _id: false };
              referencesProjector[reference.idField] = true;
              // Query the references collection
              // WARNING: If the query is wrong it will not make the code fail until the cursor in consumed
              const referencesCursor = await database[referenceName]
                .find(referencesQuery)
                .project(referencesProjector);
              const results = await referencesCursor
                .map(ref => ref[reference.idField])
                .toArray();
              // Update the original query by removing the original field and adding the parsed one
              delete originalQuery[field];
              originalQuery[reference.projectIdsField] = { $in: results };
            }
          };
          // Start the parsing function
          await parseReferencesQuery(projectsQuery);
          if (!finder.$and) finder.$and = [];
          finder.$and.push(projectsQuery);
        }
      }
      // Get all projects
      const cursor = await database.projects.find(
        finder,
        // Discard the heaviest fields we do not need anyway
        {
          projection: {
            id: false,
            'metadata.pdbInfo': false,
            'metadata.INTERACTIONS': false,
            'metadata.CHARGES': false,
            'metadata.SEQUENCES': false,
            'metadata.DOMAINS': false,
          },
        },
      );
      // Consume the cursor
      const data = await cursor.toArray();
      // Set the summary object to be returned
      // Then all mined data will be written into it
      const summary = {};
      // Get the number of projects
      summary['projectsCount'] = data.length;
      // Count the number of MDs
      let mdCount = 0;
      data.forEach(project => {
        // If it is the old format then it only counts as 1 MD
        if (!project.mds) return mdCount += 1;
        // Otherwise, count the number of MDs
        mdCount += project.mds.length;
      });
      summary['mdCount'] = mdCount;
      // Get the total MD time
      const totalTime = data
        .map(project => {
          const metadata = project.metadata;
          if (!metadata) return 0;
          const length = +metadata.LENGTH;
          const mds = project.mds;
          if (!mds) return length;
          // Calculate the time based in the framestep and the number of frames of each MD
          if (metadata.FRAMESTEP) return mds.reduce((acc, curr) => acc + curr.frames * metadata.FRAMESTEP, 0);
          // If we are missing the framestep then use the length, but here we assume some error
          // DANI: Esto no es preciso, pues podrían haber réplicas con menos frames (e.g. las moonshot)
          // DANI: Esto se solucionará al reemplazar el campo de LENGTH for el de FRAMESTEP
          return length * mds.length;
        })
        .reduce((acc, curr) => {
          if (curr) {
            return acc + curr;
          } else return acc;
        }, 0);
      summary['totalTime'] = totalTime;
      // Get the total MD number of frames
      const totalFrames = data
        .map(project => {
          const metadata = project.metadata;
          if (!metadata) return 0;
          const mds = project.mds;
          if (!mds) return +metadata.SNAPSHOTS;
          return mds.reduce((acc, curr) => (acc + curr.frames), 0);
        })
        .reduce((acc, curr) => {
          if (curr) {
            return acc + curr;
          } else return acc;
        }, 0);
      summary['totalFrames'] = totalFrames;
      // Get the total number of files
      const totalFiles = data
        .map(project => {
          const mds = project.mds;
          if (!mds) {
            const files = project.files;
            if (!files) return 0;
            return files.length;
          }
          return mds.reduce((acc, curr) => (acc + curr.files ? curr.files.length : 0), 0);
        })
        .reduce((acc, curr) => {
          if (curr) {
            return acc + curr;
          } else return acc;
        }, 0);
      summary['totalFiles'] = totalFiles;
      // Get the total number of analyses
      const totalAnalyses = data
        .map(project => {
          const mds = project.mds;
          if (!mds) {
            const analyses = project.analyses;
            if (!analyses) return 0;
            return analyses.length;
          }
          return mds.reduce((acc, curr) => (acc + curr.analyses ? curr.analyses.length : 0), 0);
        })
        .reduce((acc, curr) => {
          if (curr) {
            return acc + curr;
          } else return acc;
        }, 0);
      summary['totalAnalyses'] = totalAnalyses;
      // Send all mined data
      return summary;
    }
  }),
);

module.exports = router;