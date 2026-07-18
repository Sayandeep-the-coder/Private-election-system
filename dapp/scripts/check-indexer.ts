async function check() {
  const query = `
    query {
      unshieldedBalances(address: "e54037c02899034a91a0faf40caba15e5abfd0004b9d8abaed3eec1a18cd1e92") {
        tokenType
        amount
      }
    }
  `;
  const res = await fetch('https://indexer.preview.midnight.network/api/v4/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

check().catch(console.error);
