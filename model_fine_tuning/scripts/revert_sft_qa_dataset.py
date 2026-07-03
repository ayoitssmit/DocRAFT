import json
import os

def main():
    input_file = "sft_qa_dataset.jsonl"
    output_file = "sft_qa_dataset.jsonl.orig"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found.")
        return
        
    print(f"Reverting {input_file} back to instruction/response format...")
    
    reverted_count = 0
    with open(input_file, "r", encoding="utf-8") as f_in, open(output_file, "w", encoding="utf-8") as f_out:
        for line in f_in:
            if not line.strip():
                continue
                
            record = json.loads(line)
            messages = record.get("messages", [])
            
            instruction = ""
            response = ""
            for m in messages:
                if m.get("role") == "user":
                    instruction = m.get("content", "")
                elif m.get("role") == "assistant":
                    response = m.get("content", "")
                    
            orig_record = {
                "instruction": instruction,
                "response": response
            }
            
            f_out.write(json.dumps(orig_record, ensure_ascii=False) + "\n")
            reverted_count += 1
            
    print(f"Successfully reverted {reverted_count} lines to {output_file}.")
    
    try:
        if os.path.exists(input_file):
            os.remove(input_file)
        os.rename(output_file, input_file)
        print(f"Overwrote {input_file} with reverted data.")
    except Exception as e:
        print(f"Error replacing file: {e}")

if __name__ == "__main__":
    main()
