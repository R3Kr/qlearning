import { useEffect, useRef, useState } from "react";
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import "./App.css";
import {
  AgentParameters,
  Environment,
  EnvironmentParameters,
  GridVec,
  QTable,
  createQTable,
  run_agent,
  train_agent,
} from "./qlearning";
import {

  useMutation,



} from "@tanstack/react-query";

const isGoal = (
  x: number,
  y: number,
  { goal_state }: EnvironmentParameters
) => {
  if (goal_state) {
    return x === goal_state[1] && y === goal_state[0];
  } else {
    return false;
  }
};

const isObstacle: (
  x: number,
  y: number,
  params: EnvironmentParameters
) => boolean = (x, y, { obstacles }) => {
  return obstacles.findIndex((v) => v[0] === y && v[1] === x) === -1
    ? false
    : true;
};

const isBoost: (
  x: number,
  y: number,
  params: EnvironmentParameters
) => boolean = (x, y, { boosts }) => {
  return boosts.findIndex((v) => v[0] === y && v[1] === x) === -1
    ? false
    : true;
};

const isPlayer: (x: number, y: number, agentState: GridVec) => boolean = (
  x,
  y,
  agentState
) => {
  return x === agentState[1] && y === agentState[0];
};

// const trainCallback = (g: GridVec, callback: () => void, ) => {
//   new Promise(resolve => setTimeout(resolve, ms));
// }

function App() {
  const isMounted = useRef(false);
  const [environmentParams, setEnvironmentParams] =
    useState<EnvironmentParameters>({
      grid_size: [10, 10],
      goal_state: [0, 4],
      obstacles: [],
      boosts: [],
    });

  const [agentParams, setAgentParams] = useState<AgentParameters>({
    learning_rate: 0.1,
    discount_factor: 0.95,
    episodes: 10000,
    max_steps_per_episode: 100,
    initial_agent_state: [4, 0],
  });

  const [stepSpeed, setStepSpeed] = useState(1000);
  const stepSpeedRef = useRef({ value: stepSpeed });
  useEffect(() => {
    stepSpeedRef.current.value = stepSpeed;
  }, [stepSpeed]);

  const [agentState, setAgentState] = useState<GridVec>(
    agentParams.initial_agent_state
  );
  useEffect(() => {
    setAgentState(agentParams.initial_agent_state);
  }, [agentParams.initial_agent_state]);

  const Q = useRef<QTable>(createQTable(environmentParams));
  const controller = useRef<AbortController>();

  useEffect(() => {
    isMounted.current
      ? (Q.current = createQTable(environmentParams))
      : (isMounted.current = true);
  }, [environmentParams.grid_size]);

  const [isTraining, setIsTraining] = useState(false);
  // const [isRunning, setIsRunning] = useState(false);

  const { mutate, isSuccess } = useMutation({
    mutationFn: async () => {
      setIsTraining(true);
      const res = await new Promise<boolean>((resolve, reject) => {
        setTimeout(() => {
          train_agent(Q.current, agentParams, environmentParams);
          resolve(true);
        }, 0);
      });
      setIsTraining(false);
    },
  });

  const {
    mutate: run,
    isPending: isRunning,
    isError: isAborted,
    reset,
  } = useMutation({
    mutationFn: async () =>
      await new Promise<void>(async (res, rej) => {
        controller.current = new AbortController();
        const { signal } = controller.current;
        signal.addEventListener("abort", () => {
          setAgentState(agentParams.initial_agent_state);
          rej(new Error("aborted"));
        });
        await run_agent(
          Q.current,
          {pos: agentParams.initial_agent_state, boosted: false},
          new Environment(environmentParams),
          stepSpeedRef.current,
          signal,
          setAgentState
        );
        res();
      }),
  });

  const [isTrained, setIsTrained] = useState(false);
  useEffect(() => {
    if (!isTraining) {
      let allzeroes = true;
      for (const vals of Q.current.values()) {
        for (const val of vals.values()) {
          if (val !== 0) {
            allzeroes = false;
            break;
          }
        }
      }
      allzeroes ? setIsTrained(false) : setIsTrained(true);
    } else {
      setIsTrained(false);
    }
  }, [isTraining]);

  useEffect(() => {
    if (isAborted) {
      setTimeout(reset, 1000);
    }
  }, [isAborted]);

  // const handleEnvParamsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const data = {...environmentParams}
  //   data[e.target.name] = e.target.valueAsNumber;
  //   setEnvironmentParams({ ...environmentParams });
  // };

  return (
    <>
      <label>Step speed: </label>
      <input
        type="number"
        value={stepSpeed}
        onChange={(e) => setStepSpeed(e.target.valueAsNumber)}
      />
      <h2>Grid size</h2>
      <label>X: </label>
      <input
        type="number"
        value={environmentParams.grid_size[1]}
        onChange={(e) =>
          setEnvironmentParams({
            ...environmentParams,
            grid_size: [environmentParams.grid_size[0], e.target.valueAsNumber],
          })
        }
      />
      <label>Y: </label>
      <input
        type="number"
        value={environmentParams.grid_size[0]}
        onChange={(e) =>
          setEnvironmentParams({
            ...environmentParams,
            grid_size: [e.target.valueAsNumber, environmentParams.grid_size[1]],
          })
        }
      />
      <h2>Goal</h2>
      <label>X: </label>
      <input
        type="number"
        value={environmentParams.goal_state![1]}
        onChange={(e) =>
          setEnvironmentParams({
            ...environmentParams,
            goal_state: [
              environmentParams.goal_state![0],
              e.target.valueAsNumber,
            ],
          })
        }
      />
      <label>Y: </label>
      <input
        type="number"
        value={environmentParams.goal_state![0]}
        onChange={(e) =>
          setEnvironmentParams({
            ...environmentParams,
            goal_state: [
              e.target.valueAsNumber,
              environmentParams.goal_state![1],
            ],
          })
        }
      />

      <h2>Agent initial position</h2>
      <label>X: </label>
      <input
        type="number"
        value={agentParams.initial_agent_state[1]}
        onChange={(e) =>
          setAgentParams({
            ...agentParams,
            initial_agent_state: [
              agentParams.initial_agent_state[0],
              e.target.valueAsNumber,
            ],
          })
        }
      />
      <label>Y: </label>
      <input
        type="number"
        value={agentParams.initial_agent_state[0]}
        onChange={(e) =>
          setAgentParams({
            ...agentParams,
            initial_agent_state: [
              e.target.valueAsNumber,
              agentParams.initial_agent_state[1],
            ],
          })
        }
      />
      <h2>Agent Parameters</h2>
      <label>Learning rate: </label>
      <input
        type="number"
        value={agentParams.learning_rate}
        onChange={(e) =>
          setAgentParams({
            ...agentParams,
            learning_rate: e.target.valueAsNumber,
          })
        }
      />
      <label>Discount factor: </label>
      <input
        type="number"
        value={agentParams.discount_factor}
        onChange={(e) =>
          setAgentParams({
            ...agentParams,
            discount_factor: e.target.valueAsNumber,
          })
        }
      />
      <label>Episodes: </label>
      <input
        type="number"
        value={agentParams.episodes}
        onChange={(e) =>
          setAgentParams({
            ...agentParams,
            episodes: e.target.valueAsNumber,
          })
        }
      />
      <label>Max steps per episode: </label>
      <input
        type="number"
        value={agentParams.max_steps_per_episode}
        onChange={(e) =>
          setAgentParams({
            ...agentParams,
            max_steps_per_episode: e.target.valueAsNumber,
          })
        }
      />

      <div className="grid-container">
        {[...Array(environmentParams.grid_size[0]).keys()].map((y) => (
          <div className="grid-row" key={y}>
            {[...Array(environmentParams.grid_size[1]).keys()].map((x) => (
              <div
                key={"" + x + "" + y}
                className={`grid-item center-text-both ${
                  isGoal(x, y, environmentParams) && "goal"
                } ${isObstacle(x, y, environmentParams) && "obstacle"} ${
                  isBoost(x, y, environmentParams) && "boost"
                }
            `}
                onClick={(e) => {
                  if (!isRunning) {
                    const index = environmentParams.obstacles
                      .map((o) => o.toString())
                      .findIndex((o) => {
                        return o === [y, x].toString();
                      });
                    index === -1
                      ? setEnvironmentParams({
                          ...environmentParams,
                          obstacles: [...environmentParams.obstacles, [y, x]],
                        })
                      : setEnvironmentParams({
                          ...environmentParams,
                          obstacles: [
                            ...environmentParams.obstacles.filter(
                              (_, i) => i !== index
                            ),
                          ],
                        });
                  }
                }}
                onDoubleClick={(e) => {
                  if (!isRunning) {
                    const index = environmentParams.boosts
                      .map((o) => o.toString())
                      .findIndex((o) => {
                        return o === [y, x].toString();
                      });
                    index === -1
                      ? setEnvironmentParams({
                          ...environmentParams,
                          boosts: [...environmentParams.boosts, [y, x]],
                        })
                      : setEnvironmentParams({
                          ...environmentParams,
                          boosts: [
                            ...environmentParams.boosts.filter(
                              (_, i) => i !== index
                            ),
                          ],
                        });
                  }
                }}
              >
                {isPlayer(x, y, agentState) && "X"}
              </div>
            ))}
          </div>
        ))}
        <div>
          <button onClick={() => mutate()}>
            {isTraining
              ? "Training..."
              : isTrained
              ? "Model is now trained!"
              : `Train the model`}
          </button>
          {isTrained && (
            <button
              onClick={() => {
                Q.current = createQTable(environmentParams);
                setIsTrained(false);
              }}
            >
              Purge training data
            </button>
          )}
        </div>
        <button
          onClick={isRunning ? () => controller.current?.abort() : () => run()}
        >
          {isRunning ? "Cancel" : isAborted ? "Aborted" : "Run the model"}
        </button>
      </div>
    </>
  );
}

export default App;
