/** Design state with an undo stack. Pure reducer, scenario-agnostic. */

export interface DesignState<O> {
  design: O[]
  past: O[][]
  selectedId: string | null
}

export type DesignAction<O> =
  | { type: 'commit'; design: O[]; selectId?: string | null }
  | { type: 'select'; id: string | null }
  | { type: 'undo' }
  | { type: 'reset'; design: O[] }

const MAX_HISTORY = 100

export function initDesignState<O>(design: O[]): DesignState<O> {
  return { design, past: [], selectedId: null }
}

export function designReducer<O extends { id: string }>(
  state: DesignState<O>,
  action: DesignAction<O>,
): DesignState<O> {
  switch (action.type) {
    case 'commit': {
      if (action.design === state.design) return state
      const past = [...state.past, state.design].slice(-MAX_HISTORY)
      const selectedId =
        action.selectId !== undefined ? action.selectId : keepSelection(action.design, state.selectedId)
      return { design: action.design, past, selectedId }
    }
    case 'select':
      return { ...state, selectedId: action.id }
    case 'undo': {
      if (state.past.length === 0) return state
      const design = state.past[state.past.length - 1]
      return { design, past: state.past.slice(0, -1), selectedId: keepSelection(design, state.selectedId) }
    }
    case 'reset':
      return { design: action.design, past: [], selectedId: null }
  }
}

function keepSelection<O extends { id: string }>(design: O[], id: string | null) {
  return id && design.some((o) => o.id === id) ? id : null
}
