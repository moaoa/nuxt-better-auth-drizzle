const rawJson = process.argv[2];

if (!rawJson) {
  console.log("No json provided");
  process.exit(1);
}

const value = JSON.parse(rawJson);

let sql = value.message.query;

value.message.params.forEach((item: string, index: number) => {
  if (typeof item === "string") {
    sql = sql.replace(`$${index + 1}`, `'${item}'`);
  } else {
    sql = sql.replace(`$${index + 1}`, item);
  }
});

console.log("===================");

console.log(sql);
