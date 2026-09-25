import { evaluateObservationJobs } from '../simulation/life/v4/observation-jobs.js';
import { debug } from './debugdev.js';

const evaluate = jobs => evaluateObservationJobs(jobs, debug?.listeners);
const measured = debug?.wrap('pool.helper', evaluate) ?? evaluate;

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, results: measured(data.jobs) });
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error.message || error) });
  }
};
