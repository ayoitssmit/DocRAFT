import json
import os

def main():
    input_file = "sft_qa_dataset.jsonl"
    output_file = "sft_qa_dataset_chatml.jsonl"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found.")
        return
        
    print(f"Converting {input_file} to ChatML format in new file {output_file}...")
    
    converted_count = 0
    with open(input_file, "r", encoding="utf-8") as f_in, open(output_file, "w", encoding="utf-8") as f_out:
        for line in f_in:
            if not line.strip():
                continue
                
            record = json.loads(line)
            instruction = record.get("instruction", "")
            response = record.get("response", "")
            
            chatml_record = {
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": instruction},
                    {"role": "assistant", "content": response}
                ]
            }
            
            f_out.write(json.dumps(chatml_record, ensure_ascii=False) + "\n")
            converted_count += 1
            
    print(f"Successfully converted {converted_count} lines to {output_file}.")

if __name__ == "__main__":
    main()
