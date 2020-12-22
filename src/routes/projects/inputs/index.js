const Router = require('express').Router;

const handler = require('../../../utils/generic-handler');

const { NOT_FOUND } = require('../../../utils/status-codes');
// Mongo DB filter that only returns published results when the environment is set as "production"
const publishedFilter = require('../../../utils/published-filter');
// Adds the project associated ID from mongo db to the provided object
const augmentFilterWithIDOrAccession = require('../../../utils/augment-filter-with-id-or-accession');

const analysisRouter = Router({ mergeParams: true });

// This endpoint builds the MoDEL workflow's 'inputs.json' file
module.exports = (_, { projects }) => {
  // Root
  analysisRouter.route('/').get(
    handler({
      retriever(request) {
        // Return the project which matches the request accession
        return projects.findOne(
          augmentFilterWithIDOrAccession(
            publishedFilter,
            request.params.project,
          ),
          // But return only the "metadata" attribute
          { projection: { _id: false, metadata: true } },
        );
      },
      // If there is nothing retrieved send a NOT_FOUND status in the header
      headers(response, retrieved) {
        if (!retrieved) response.sendStatus(NOT_FOUND);
      },
      // If there is retrieved and the retrieved has metadata then send the inputs file
      body(response, retrieved) {
        if (retrieved) {
          const metadata = retrieved.metadata;
          if (metadata) {
            const inputs = {
              original_topology_filename: 'md.imaged.rot.dry.pdb',
              original_trajectory_filename: 'md.imaged.rot.xtc',
              preprocess_protocol: 0,
              chainnames: metadata.CHAINNAMES,
              ligands: metadata.LIGANDS,
              domains: metadata.DOMAINS,
              interactions: metadata.INTERACTIONS,
              unit: metadata.UNIT,
              membrane: metadata.MEMBRANE,
              pdbId: metadata.PDBID,
              name: metadata.NAME,
              description: metadata.DESCRIPTION,
              authors: metadata.AUTHORS,
              program: metadata.PROGRAM,
              version: metadata.VERSION,
              license: metadata.LICENSE,
              linkcense: metadata.LINKCENSE,
              citation: metadata.CITATION,
              length: metadata.LENGTH,
              frequency: metadata.FREQUENCY,
              temp: metadata.TEMP,
              ensemble: metadata.ENSEMBLE,
              timestep: metadata.TIMESTEP,
              pcoupling: metadata.PCOUPLING,
              ff: metadata.FF,
              wat: metadata.WAT,
              boxtype: metadata.BOXTYPE,
            };
            response.json(inputs);
          } else response.json({ error: 'There is no metadata' });
        } else response.end();
      },
    }),
  );

  return analysisRouter;
};
