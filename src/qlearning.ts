export type GridVec = [number, number];

export interface PlayerState {
  pos: GridVec,
  boosted: boolean
}
export interface ActionResult {
  next_state: PlayerState;
  reward: number;
  reached_goal: boolean;
}

export interface EnvironmentParameters {
  grid_size: GridVec;
  goal_state?: GridVec;
  obstacles: Array<GridVec>;
  boosts: Array<GridVec>;
}

export interface AgentParameters {
  learning_rate: number;
  discount_factor: number;
  episodes: number;
  max_steps_per_episode: number;
  initial_agent_state: GridVec;
}

export type QTable = Map<string, Map<keyof typeof actions, number>>;
//Environment

// const grid_size: GridVec = [5, 5] as const;

// const goal_state: GridVec = [0, 4] as const;
// const initial_player_state: GridVec = [4, 0] as const;

// const obstacles: Array<GridVec> = [
//   // [2, 9],
//   // [2, 3],
//   // [9, 7],
//   // [0, 6],
//   // [9, 2],
//   // [1, 3],
//   // [8, 2],
//   // [8, 6],
//   // [5, 7],
//   // [8, 9],
// ] as const;
const actions = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
} as const;

//Q-table
export const createQTable: (
  params: EnvironmentParameters
) => Map<string, Map<keyof typeof actions, number>> = ({ grid_size }) =>
  new Map<string, Map<keyof typeof actions, number>>(
    [...Array(grid_size[0]).keys()].flatMap((y) =>
      [...Array(grid_size[1]).keys()].flatMap((x) =>
        [...Array(2).keys()].map((bool) => {
          return [
            JSON.stringify({pos: [y,x], boosted: bool === 1 ? true : false}), //.toString(),
            new Map<keyof typeof actions, number>(
              (Object.keys(actions) as (keyof typeof actions)[]).map((k) => [
                k,
                0,
              ])
            ),
          ];
        })
      )
    )
  );

export class Environment {
  params: EnvironmentParameters;
  constructor(params: EnvironmentParameters) {
    this.params = params;
  }

  step: (
    action: keyof typeof actions,
    state: { pos: GridVec; boosted: boolean }
  ) => ActionResult = (action, { pos, boosted }) => {
    const { grid_size, obstacles, goal_state, boosts } = this.params;
    const new_state: GridVec = [
      actions[action][0] + pos[0],
      actions[action][1] + pos[1],
    ] as const;
    const boosted_new_state: GridVec = [
      actions[action][0] * 2 + pos[0],
      actions[action][1] * 2 + pos[1],
    ] as const;

    if (
      !boosted
        ? new_state[0] < 0 ||
          new_state[1] < 0 ||
          new_state[0] >= grid_size[0] ||
          new_state[1] >= grid_size[1]
        : boosted_new_state[0] < 0 ||
          boosted_new_state[1] < 0 ||
          boosted_new_state[0] >= grid_size[0] ||
          boosted_new_state[1] >= grid_size[1]
    ) {
      return {
        next_state: {
          pos:
            boosted &&
            !(
              new_state[0] < 0 ||
              new_state[1] < 0 ||
              new_state[0] >= grid_size[0] ||
              new_state[1] >= grid_size[1]
            )
              ? new_state
              : pos,
          boosted,
        },
        reward: -100,
        reached_goal: false,
      };
    }

    if (
      !boosted &&
      boosts.find(
        (vec) => vec[0] === new_state[0] && vec[1] === new_state[1]
      ) !== undefined
    ) {
      console.log("Reached boosted block")
      return {
        next_state: { pos: new_state, boosted: true },
        reward: -1,
        reached_goal: false,
      };
    }

    if (
      !boosted &&
      obstacles.find(
        (vec) => vec[0] === new_state[0] && vec[1] === new_state[1]
      ) !== undefined
    ) {
      return {
        next_state: { pos, boosted },
        reward: -100,
        reached_goal: false,
      };
    }

    if (
      boosted &&
      obstacles.find(
        (vec) =>
          vec[0] === boosted_new_state[0] && vec[1] === boosted_new_state[1]
      ) !== undefined
    ) {
      return {
        next_state: {
          pos:
            obstacles.find(
              (vec) => vec[0] === new_state[0] && vec[1] === new_state[1]
            ) !== undefined
              ? pos
              : new_state,
          boosted,
        },
        reward: -100,
        reached_goal: false,
      };
    }

    // environment_player_state[0] = new_state[0];
    // environment_player_state[1] = new_state[1];
    if (
      goal_state &&
      goal_state[0] === new_state[0] &&
      goal_state[1] === new_state[1]
    ) {
      return {
        next_state: { pos: new_state, boosted },
        reward: 100,
        reached_goal: true,
      };
    }

    if (
      boosted &&
      goal_state &&
      goal_state[0] === boosted_new_state[0] &&
      goal_state[1] === boosted_new_state[1]
    ) {
      return {
        next_state: { pos: boosted_new_state, boosted },
        reward: 100,
        reached_goal: true,
      };
    }

    console.log(boosted)
    return {
      next_state: { pos: boosted ? boosted_new_state : new_state, boosted },
      reward: -1,
      reached_goal: false,
    };
  };
}

//Parameters
// const learning_rate = 0.1;
// const discount_factor = 0.95;
// const episodes = 100000;
// const max_steps_per_episode = 100;
export const run_agent: (
  q: Map<string, Map<keyof typeof actions, number>>,
  agent_state: PlayerState,
  env: Environment,
  step_speed: { value: number },
  signal?: AbortSignal,
  updatePlayerCallback?: (s: GridVec | ((v: GridVec) => GridVec)) => void
) => Promise<void> = async (
  Q,
  agent_state,
  env,
  step_speed,
  signal,
  updatePlayerCallback
) => {
  const player_state = { pos: [...agent_state.pos] as GridVec, boosted: agent_state.boosted };
  console.log(player_state);
  const [next_action, _] = [
    ...Q.get(JSON.stringify(player_state))!.entries(),
  ].reduce((prev, curr) => (curr[1] < prev[1] ? prev : curr));
  const { next_state, reached_goal } = env.step(next_action, player_state);
  player_state.pos[0] = next_state.pos[0];
  player_state.pos[1] = next_state.pos[1];
  player_state.boosted = next_state.boosted;
  if (updatePlayerCallback) {
    updatePlayerCallback(player_state.pos);
  }
  await new Promise((resolve) => setTimeout(resolve, step_speed.value));

  if (reached_goal || signal?.aborted) {
    return;
  } else {
    return await run_agent(
      Q,
      player_state,
      env,
      step_speed,
      signal,
      updatePlayerCallback
    );
  }
};

export const train_agent: (
  q: Map<string, Map<keyof typeof actions, number>>,
  agent_params: AgentParameters,
  env_params: EnvironmentParameters,
  updatePlayerCallback?: (s: GridVec) => void
) => void = (
  Q,
  {
    learning_rate,
    discount_factor,
    episodes,
    max_steps_per_episode,
    initial_agent_state,
  },
  env_params,
  updatePlayerCallback
) => {
  for (let i = 0; i < episodes; i++) {
    const player_state = {
      pos: [...initial_agent_state] as GridVec,
      boosted: false,
    };
    const env = new Environment(env_params);
    if (updatePlayerCallback) {
      updatePlayerCallback(player_state.pos);
    }

    for (let y = 0; y < max_steps_per_episode; y++) {
      const action_index = Math.floor(Math.random() * 4);
      const action = [...Object.keys(actions)][
        action_index
      ] as keyof typeof actions;

      const { next_state, reward, reached_goal } = env.step(
        action,
        player_state
      );
      const [_, next_state_max_q] = [
        ...Q.get(JSON.stringify(next_state))!.entries(),
      ].reduce((prev, curr) => (curr[1] < prev[1] ? prev : curr));
      //Q-learning
      Q.get(JSON.stringify(player_state))?.set(
        action,
        Q.get(JSON.stringify(player_state))!.get(action)! +
          learning_rate *
            (reward +
              discount_factor * next_state_max_q -
              Q.get(JSON.stringify(player_state))!.get(action)!)
      );

      player_state.pos[0] = next_state.pos[0];
      player_state.pos[1] = next_state.pos[1];
      player_state.boosted = next_state.boosted;

      if (updatePlayerCallback) {
        updatePlayerCallback(player_state.pos);
      }
      //console.log(`Episode: ${i} Step: ${y}`);
      //await new Promise(resolve => setTimeout(resolve, 10));
      if (reached_goal) {
        break;
      }
    }
  }
  console.log(Q);
};

console.log(
  createQTable({
    grid_size: [10, 10],
    goal_state: [0, 4],
    obstacles: [],
    boosts: [],
  })
);
