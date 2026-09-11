# Development Guide

## Adding a New Module to Queen

1. **Create the Backend RPCD Plugin**:
   Create `/usr/libexec/rpcd/luci.mymodule` with executable permissions (`0755`):
   ```ucode
   #!/usr/bin/env ucode
   import * as fs from 'fs';
   import * as uci from 'uci';

   let action = ARGV[0];
   let method = ARGV[1];

   if (action == 'list') {
       print('{"get_status": {}}
');
   } else if (action == 'call' && method == 'get_status') {
       print('{"status": "ok"}
');
   }
   ```

2. **Register ACL Permissions**:
   Add permissions to `components/acl.json`:
   ```json
   "luci.mymodule": [ "*" ]
   ```

3. **Register Menu Route**:
   Add the route in `components/menu.json`:
   ```json
   "admin/queenx/mymodule": {
       "title": "My Module",
       "order": 6,
       "action": {
           "type": "view",
           "path": "queenx/mymodule"
       }
   }
   ```

4. **Build Frontend View**:
   Create `/www/luci-static/resources/view/queenx/mymodule.js` using `view.extend`.
