import sys
import os
import time
import difflib
from datetime import datetime

# Adjust path to import backend modules properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("[Direct Evaluator] Initializing modules and clients...")
import main
from qdrant_client import QdrantClient
from ollama import Client as OllamaClient
from ingestion.embedder import DocRAFTEmbedder
from retrieval.reranker import DocRAFTReranker

# Initialize main globals manually to bypass FastAPI startup lifespan
main.qdrant_client = QdrantClient(path="local_qdrant")
main.ollama_client = OllamaClient(host="http://127.0.0.1:11434")
main.doc_embedder = DocRAFTEmbedder()
main.doc_reranker = DocRAFTReranker()
print("[Direct Evaluator] All clients ready!")

from retrieval.agent import run_rag_agent

# ==========================================
# TEST CASES
# ==========================================
TARGET_DOCUMENT = "Raft Consensus Server Setup & Implementation Guide.pdf"
TEST_CASES = [
    {
        "id": "TC-001",
        "question": "What are the specific persistent and volatile state variables a Raft server must maintain according to the guide?",
        "ground_truth_keywords": [
            "current_term",
            "voted_for",
            "log",
            "commit_index",
            "last_applied"
        ],
        "ground_truth": (
            "Persistent State:\n"
            "- current_term: Latest term the server has seen (initialized to 0).\n"
            "- voted_for: Candidate ID that received a vote in the current term.\n"
            "- log: Log entries containing commands and terms.\n\n"
            "Volatile State:\n"
            "- commit_index: Index of highest log entry known to be committed.\n"
            "- last_applied: Index of highest log entry applied to state machine."
        )
    },
    {
        "id": "TC-002",
        "question": "Under what rules does a server grant a vote to a candidate during a RequestVote RPC? List the specific rules for the receiver.",
        "ground_truth_keywords": [
            "Reply false if term < current_term",
            "voted_for is null",
            "up-to-date"
        ],
        "ground_truth": (
            "1. Reply false if term < current_term.\n"
            "2. If voted_for is null or candidate_id, and the candidate's log is at least as up-to-date as the receiver's log, grant the vote."
        )
    },
    {
        "id": "TC-003",
        "question": "What are the receiver implementation rules for the AppendEntries RPC in Raft? List all 5 rules.",
        "ground_truth_keywords": [
            "term < current_term",
            "prev_log_index",
            "conflicts",
            "delete the existing entry",
            "Append any new entries",
            "leader_commit > commit_index"
        ],
        "ground_truth": (
            "1. Reply false if term < current_term.\n"
            "2. Reply false if the log doesn't contain an entry at prev_log_index whose term matches prev_log_term.\n"
            "3. If an existing entry conflicts with a new one (same index but different terms), delete the existing entry and all that follow it.\n"
            "4. Append any new entries not already in the log.\n"
            "5. If leader_commit > commit_index, set commit_index = min(leader_commit, index of last new entry)."
        )
    },
    {
        "id": "TC-004",
        "question": "Describe the step-by-step actions a Raft candidate must take when starting an election, including the transition rules.",
        "ground_truth_keywords": [
            "Increment current_term",
            "Vote for self",
            "Reset the election timer",
            "Send RequestVote RPCs",
            "majority of servers"
        ],
        "ground_truth": (
            "On conversion to a candidate, start an election:\n"
            "1. Increment current_term.\n"
            "2. Vote for self.\n"
            "3. Reset the election timer.\n"
            "4. Send RequestVote RPCs to all other servers.\n"
            "- If votes are received from a majority of servers: become Leader.\n"
            "- If an AppendEntries RPC is received from a new leader: convert to Follower.\n"
            "- If the election timeout elapses: start a new election."
        )
    },
    {
        "id": "TC-005",
        "question": "What are the key rules and responsibilities of a Leader in Raft upon election and when a client command is received?",
        "ground_truth_keywords": [
            "AppendEntries RPCs",
            "heartbeats",
            "prevent follower election timeouts",
            "append the entry to the local log",
            "state machine"
        ],
        "ground_truth": (
            "- Upon election: send initial empty AppendEntries RPCs (heartbeats) to each server; repeat during idle periods to prevent follower election timeouts.\n"
            "- If a command is received from a client: append the entry to the local log, and respond after the entry is applied to the state machine."
        )
    }
]

# ==========================================
# EVALUATOR ENGINE
# ==========================================
class RAGEvaluatorDirect:
    def __init__(self):
        self.results = []

    def calculate_similarity(self, expected, actual):
        if not actual: return 0.0
        matcher = difflib.SequenceMatcher(None, expected.lower(), actual.lower())
        return matcher.ratio()

    def check_keywords(self, keywords, actual_response):
        if not actual_response: return 0.0
        actual_lower = actual_response.lower()
        found = sum(1 for kw in keywords if kw.lower() in actual_lower)
        return found / len(keywords) if keywords else 1.0

    def run_tests(self, test_cases, document_filter):
        print(f"{'='*80}\nStarting DocRAFT Automated Evaluation (DIRECT MODE)\n{'='*80}")
        total_time = 0.0
        successful = 0

        for i, test in enumerate(test_cases):
            print(f"\nRunning {test['id']}...")
            
            start_time = time.time()
            test_record = {
                "id": test["id"],
                "question": test["question"],
                "status": "FAILED",
                "latency_sec": 0.0,
                "keyword_score": 0.0,
                "similarity_score": 0.0,
                "sources_retrieved": 0,
                "agent_response": "",
                "error": None
            }

            try:
                # Direct Python invocation bypasses Uvicorn/HTTP overhead and proxy issues
                result = run_rag_agent(
                    query=test["question"],
                    messages=[],
                    document_filter=[document_filter]
                )
                latency = time.time() - start_time
                test_record["latency_sec"] = round(latency, 2)
                total_time += latency

                agent_answer = result.get("response", "")
                sources = result.get("sources", [])
                
                # Compute Metrics
                test_record["status"] = "SUCCESS"
                test_record["similarity_score"] = round(self.calculate_similarity(test["ground_truth"], agent_answer), 2)
                test_record["keyword_score"] = round(self.check_keywords(test["ground_truth_keywords"], agent_answer), 2)
                test_record["sources_retrieved"] = len(sources)
                test_record["agent_response"] = agent_answer
                successful += 1

                print(f"  [✓] Direct execution successful ({test_record['latency_sec']}s)")
                print(f"  [-] Keyword Match Score: {test_record['keyword_score'] * 100}%")
                print(f"  [-] Text Similarity Score: {test_record['similarity_score'] * 100}%")
                print(f"  [-] Sources Hit: {test_record['sources_retrieved']}")
                
                if test_record['keyword_score'] < 0.8:
                    print("  [!] WARNING: Agent missed critical keywords.")

            except Exception as e:
                test_record["error"] = str(e)
                print(f"  [x] Direct execution failed: {e}")

            self.results.append(test_record)

        # Print Final Summary
        print(f"\n{'='*80}\nDETAILED EVALUATION REPORT SUMMARY\n{'='*80}")
        print(f"Timestamp:          {datetime.now().isoformat()}")
        print(f"Total Tests Run:    {len(test_cases)}")
        print(f"Successful Calls:   {successful}")
        print(f"Failed Calls:       {len(test_cases) - successful}")
        if successful > 0:
            print(f"Average Latency:    {round(total_time / successful, 2)}s")
        print("-" * 80)
        
        for record in self.results:
            print(f"\nID: {record['id']} - {record['status']}")
            print(f"Query:   {record['question']}")
            if record['status'] == "SUCCESS":
                print(f"Latency: {record['latency_sec']}s")
                print(f"Keyword Score:    {record['keyword_score']*100}%")
                print(f"Similarity Score: {record['similarity_score']*100}%")
                print(f"Sources Used:     {record['sources_retrieved']}")
                print(f"Response Preview:\n---\n{record['agent_response'].strip()[:350]}...\n---")
            else:
                print(f"Error: {record['error']}")
        print(f"{'='*80}\n")

if __name__ == "__main__":
    evaluator = RAGEvaluatorDirect()
    evaluator.run_tests(TEST_CASES, TARGET_DOCUMENT)
