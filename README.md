# openhoud

Small experiment for running local coding agents. The default command
invokes a single agent, but the project now also exposes a simple
multi‑agent pipeline. The pipeline first plans a sequence of steps and
then dispatches each step to specialised agents such as a reader or a
writer.

```bash
openhoud "Describe repo"            # single agent
openhoud "Update README" --write    # allow writing files
openhoud "Add docstring" --pipeline # use planner + specialised agents
```
