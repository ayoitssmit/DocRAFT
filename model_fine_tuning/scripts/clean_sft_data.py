import json
import os

def format_step(step_idx, step):
    if isinstance(step, str):
        return f"{step_idx}. {step}"
    
    parts = []
    step_title = step.get("step", "")
    if step_title:
        parts.append(f"{step_title}")
    else:
        parts.append(f"Step {step_idx}")
        
    explanation = step.get("explanation", step.get("description", ""))
    if explanation:
        parts.append(f": {explanation}")
        
    code = step.get("command", step.get("code", ""))
    if code:
        if isinstance(code, list):
            code_str = "\n".join(code)
        else:
            code_str = str(code)
        # Wrap in backticks if not already wrapped
        if not code_str.strip().startswith("```"):
            parts.append(f"\n```bash\n{code_str}\n```")
        else:
            parts.append(f"\n{code_str}")
            
    return "".join(parts)

def format_code_block(cb):
    if isinstance(cb, str):
        return cb
    
    lang = cb.get("language", cb.get("lang", "bash"))
    content = cb.get("content", cb.get("code", ""))
    if not content.strip().startswith("```"):
        return f"```{lang}\n{content}\n```"
    return content

def dict_to_string(data):
    if not isinstance(data, dict):
        return str(data)
    
    parts = []
    
    # Extract introductory text
    intro = data.get("response", data.get("description", data.get("text", "")))
    if intro:
        parts.append(intro)
        
    # Handle steps
    steps = data.get("steps", [])
    if isinstance(steps, list) and steps:
        step_lines = []
        for idx, s in enumerate(steps, 1):
            step_lines.append(format_step(idx, s))
        parts.append("\n\n" + "\n\n".join(step_lines))
        
    # Handle code blocks
    code_block = data.get("code_block")
    if code_block:
        parts.append("\n\n" + format_code_block(code_block))
        
    code_blocks = data.get("code_blocks", [])
    if isinstance(code_blocks, list) and code_blocks:
        formatted_cbs = [format_code_block(cb) for cb in code_blocks]
        parts.append("\n\n" + "\n\n".join(formatted_cbs))
        
    # Handle post-text
    explanation = data.get("explanation")
    if explanation:
        parts.append("\n\n" + explanation)
        
    note = data.get("note")
    if note:
        parts.append("\n\n*Note: " + note + "*")
        
    conclusion = data.get("conclusion")
    if conclusion:
        parts.append("\n\n" + conclusion)
        
    # Fallback if dictionary was in an unrecognized format
    if not parts:
        return json.dumps(data, indent=2)
        
    return "".join(parts).strip()

def normalize_message_content(messages):
    normalized = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        if isinstance(content, dict):
            content = dict_to_string(content)
        elif isinstance(content, list):
            # Fallback for structured content
            content = "\n".join([dict_to_string(item) if isinstance(item, dict) else str(item) for item in content])
        
        normalized.append({"role": role, "content": str(content)})
    return normalized

def main():
    input_file = "03_ready_for_qlora/instructions.jsonl"
    output_file = "03_ready_for_qlora/instructions_clean.jsonl"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found.")
        return
        
    print(f"Normalizing SFT instructions from {input_file}...")
    
    processed_count = 0
    dict_conversions = 0
    
    with open(input_file, "r", encoding="utf-8") as f_in, open(output_file, "w", encoding="utf-8") as f_out:
        for line in f_in:
            if not line.strip():
                continue
                
            record = json.loads(line)
            messages = record.get("messages", [])
            
            # Count conversions
            has_dict = any(isinstance(m.get("content"), dict) for m in messages)
            if has_dict:
                dict_conversions += 1
                
            normalized_messages = normalize_message_content(messages)
            new_record = {"messages": normalized_messages}
            f_out.write(json.dumps(new_record) + "\n")
            processed_count += 1
            
    print(f"Normalization complete!")
    print(f"Total instructions processed: {processed_count}")
    print(f"Nested dictionary fields normalized to Markdown: {dict_conversions}")
    print(f"Cleaned instructions saved to: {output_file}")

if __name__ == "__main__":
    main()
