import { useEffect, useState } from "react";

import { api } from "./api";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    api
      .list()
      .then(setTodos)
      .catch(() => setError("Could not reach the backend API."));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.create(title.trim());
    setTitle("");
    refresh();
  }

  async function toggle(todo) {
    await api.update(todo.id, { completed: !todo.completed });
    refresh();
  }

  async function remove(id) {
    await api.remove(id);
    refresh();
  }

  return (
    <main className="app">
      <h1>Todo</h1>
      <p className="subtitle">React + FastAPI + Postgres, running in Docker / Kubernetes</p>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleAdd} className="add-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
        />
        <button type="submit">Add</button>
      </form>

      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id} className={todo.completed ? "completed" : ""}>
            <label>
              <input type="checkbox" checked={todo.completed} onChange={() => toggle(todo)} />
              {todo.title}
            </label>
            <button onClick={() => remove(todo.id)} aria-label="Delete">
              ×
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
