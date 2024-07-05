const fs = require('fs');
const API_KEY = 'your_api_key';
const FIRST_TASK = {
  ID: 'first_task_id',
  SAVE_STRUCTURED_DATA_STEP_ID: 'first_task_save_stuctured_data_id',
};
const SECOND_TASK = {
  ID: 'second_task_id',
  GO_STEP_ID: 'second_task_go_id',
  SAVE_STRUCTURED_DATA_STEP_ID: 'second_task_save_stuctured_data_id',
};

(async () => {
  // Trigger the first run
  const scrapedData = await triggerRun(FIRST_TASK.ID, FIRST_TASK.SAVE_STRUCTURED_DATA_STEP_ID);

  // Trigger the second run (Part 2): visit the job links from the first run and scrape the details of a particiular job
  const fullJobDetail = await getFullJobDetail(scrapedData);

  writeToFile(fullJobDetail);
})();

function writeToFile(data) {
  fs.writeFile('result.json', JSON.stringify(data), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

async function getFullJobDetail(scrapedData) {
  return await Promise.all(
    scrapedData.map(async (job) => {
      const data = {
        steps: [
          {
            uid: SECOND_TASK.GO_STEP_ID,
            action: 'go',
            config: {
              url: `https://playground.roborabbit.com${job.link}`,
            },
          },
        ],
      };

      const jobDetail = await triggerRun(SECOND_TASK.ID, SECOND_TASK.SAVE_STRUCTURED_DATA_STEP_ID, JSON.stringify(data));

      return {
        ...job,
        ...jobDetail[0],
      };
    })
  );
}

async function triggerRun(taskId, saveStructuredDataId, body) {
  return new Promise(async (resolve) => {
    const run = await runTask(taskId, body);

    if (run.status === 'running' && run.uid) {
      console.log(`Task ${run.uid} is running... Poll API to get the result`);

      const polling = setInterval(async () => {
        const runResult = await getRun(taskId, run.uid);

        if (runResult.status === 'running') {
          console.log('Still running.....');
        } else if (runResult.status === 'finished') {
          const structuredData = runResult.outputs[`${saveStructuredDataId}_save_structured_data`];
          clearInterval(polling);
          resolve(structuredData);
        }
      }, 1000);
    }
  });
}

async function runTask(taskId, body) {
  const res = await fetch(`https://api.roborabbit.com/v1/tasks/${taskId}/runs`, {
    method: 'POST',
    body: body,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  return await res.json();
}

async function getRun(taskId, runId) {
  const res = await fetch(`https://api.roborabbit.com/v1/tasks/${taskId}/runs/${runId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  const data = await res.json();

  return data;
}
