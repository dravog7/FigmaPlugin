import { encode } from '@toon-format/toon';

const data = {
    name: "Test",
    items: [
        { id: 1, value: "A" },
        { id: 2, value: "B" }
    ],
    nested: {
        key: "value"
    }
};

console.log("--- Default ---");
console.log(encode(data));

console.log("\n--- Indent 0 ---");
console.log(encode(data, { indent: 0 }));
