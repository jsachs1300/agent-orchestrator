# PR7 Review Notes

## Derived requirement status on READ

`GET /v1/requirements/{req_id}` now derives requirement status from the slice store
without persisting any new state. The stored requirement remains `status: "derived"`
when created via `POST /v1/requirements/bulk`.

### Derivation rules

When slices exist for a requirement (matched by `slice.req_id`):

- **completed**: all slices are `done`
- **blocked**: any slice is `blocked`
- **in_progress**: any slice is `in_progress` or `done`, but not all are done
- **not_started**: otherwise

### No-slice behavior

If a requirement has **no slices**, the response keeps `status: "derived"` to
preserve the existing contract.
