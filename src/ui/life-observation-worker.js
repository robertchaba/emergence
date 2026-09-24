import { evaluateObservationJobs } from '../simulation/life/v3/observation-jobs.js';

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, results: evaluateObservationJobs(data.jobs) });
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error.message || error) });
  }
};
