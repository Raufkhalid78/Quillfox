const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/sessions?select=*';
fetch(url, {
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Accept-Profile': 'auth'
  }
}).then(r => r.text()).then(console.log);
