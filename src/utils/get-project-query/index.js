// This function returns an object with the mongo object id
// This id is associated to the provided idOrAccession when it is valid
// When the idOrAccession is not valid for mongo it just returns the same idOrAccession
// In addition, it returns the provided filters

const { ObjectId } = require('mongodb');

// Set a function to ckeck if a string is a mongo id
// WARNING: Do not use the builtin 'ObjectId.isValid'
// WARNING: It returns true with whatever string 12 characters long
const isObjectId = string => /[a-z0-9]{24}/.test(string);

// Configure which collections are returned according to the host (client) who is asking
const hostConfigs = require('../../../config.js').hosts;

// Read the property "NODE_ENV" from the global ".env" file
const env = process.env.NODE_ENV.toLowerCase();

// Set the published filter according to the enviornment (.env file)
// If the environment is tagged as "production" only published projects are returned from mongo
const publishedFilter = Object.seal(
  env === 'production' || env === 'prod' ? { published: true } : {},
);

// Set the collection filter according to the request URL
// This filter is applied over the project metadata 'collections', nothing to do with mongo collections
// Note that unknown hosts (e.g. 'localhost:8000') will get all simulations, with no filter
const getCollectionFilter = request => {
  // NEVER FORGET: For the host to be inherited (and not 'localhost') you need to configure your apache
  // Add the line 'ProxyPreserveHost On' in the API location settings
  const host = request.get('host');
  const hostConfig = hostConfigs[host];
  if (!hostConfig) return {};
  const hostCollection = hostConfig.collection;
  return Object.seal(
    hostCollection ? { 'metadata.COLLECTIONS': hostCollection } : {},
  );
};

// Join both published and collection filters in one single filter which is widely used
const getBaseFilter = request => {
  const collectionFilter = getCollectionFilter(request);
  return { ...publishedFilter, ...collectionFilter };
};

// Given the API request, set the project(s) query by the following steps:
// 1 - Set a published filter according to if it we are in a development or production environment
// 2 - Set a collection filter based on the origin of the call
// 3 - Set a project and md filter based on the id or accession in the request
const getProjectQuery = request => {
  // Add the base filter to the query
  const baseFilter = getBaseFilter(request);
  const query = { ...baseFilter };
  // Get the project id or accession
  const idOrAccession = request.params.project;
  const project = idOrAccession.split('.')[0];
  // Check if the idOrAccession is an id
  if (isObjectId(project)) query._id = ObjectId(project);
  // otherwise we asume it is an accession
  else query.accession = project;
  // Return the query
  return query;
};

// Find the md index from a request
const getMdIndex = request => {
  const idOrAccession = request.params.project;
  const splits = idOrAccession.split('.');
  if (splits.length < 2) return null;
  const number = +splits[1];
  // If the second split is not parsable to a number then the request is wrong
  if (isNaN(number)) return new Error('MD number must be numeric');
  // The MD number is 1-based, so if it is 0 then the request is wrong
  if (number <= 0) return new Error('MD number must be greater than 0');
  const index = number - 1;
  return index;
};

module.exports = {
  getBaseFilter,
  getProjectQuery,
  getMdIndex,
};
