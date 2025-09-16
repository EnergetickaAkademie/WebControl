#!/usr/bin/env python3
"""
Test script to verify game end state management fix
"""

# Simulate the GroupGameManager logic
class MockScript:
    def __init__(self, rounds):
        self.rounds = list(range(rounds))
        self.current_round_index = 0
    
    def getCurrentRoundType(self):
        # Return None when past the last round (game finished)
        if self.current_round_index >= len(self.rounds):
            return None
        return f"Round{self.current_round_index}"
    
    def step(self):
        if self.current_round_index < len(self.rounds):
            self.current_round_index += 1
            return self.current_round_index < len(self.rounds)
        return False

class MockGameState:
    def __init__(self, script):
        self.script = script

def is_game_active(script):
    """Mock version of the is_game_active helper"""
    try:
        return bool(script and script.getCurrentRoundType())
    except Exception:
        return False

class GroupGameManager:
    def __init__(self):
        self.group_game_states = {}
        self.game_ended_states = {}
    
    def get_game_state(self, group_id: str):
        """Get or create game state for a specific group"""
        if group_id not in self.group_game_states:
            self.group_game_states[group_id] = MockGameState(None)
            self.game_ended_states[group_id] = False
        return self.group_game_states[group_id]
    
    def mark_game_ended(self, group_id: str):
        """Mark game as explicitly ended for a group"""
        self.game_ended_states[group_id] = True
        print(f"Game marked as ended for group {group_id}")
    
    def start_new_game(self, group_id: str, script):
        """Start a new game for a group, clearing the ended state"""
        game_state = self.get_game_state(group_id)
        game_state.script = script
        self.game_ended_states[group_id] = False
        print(f"New game started for group {group_id}, ended state cleared")
    
    def is_game_ended(self, group_id: str) -> bool:
        """Check if game is explicitly marked as ended for a group"""
        return self.game_ended_states.get(group_id, False)
    
    def is_game_active(self, group_id: str) -> bool:
        """Check if game is active for a group - considers both script state and end state"""
        if self.is_game_ended(group_id):
            return False
        
        game_state = self.get_game_state(group_id)
        script = game_state.script
        return is_game_active(script)

def test_game_end_workflow():
    """Test the complete game end workflow"""
    print("=== Testing Game End Workflow ===")
    
    group_manager = GroupGameManager()
    group_id = "group1"
    
    # Initial state - no game
    print(f"Initial state - game active: {group_manager.is_game_active(group_id)}")
    assert not group_manager.is_game_active(group_id), "Game should be inactive initially"
    
    # Start a new game with 3 rounds
    script = MockScript(3)
    group_manager.start_new_game(group_id, script)
    print(f"After starting game - game active: {group_manager.is_game_active(group_id)}")
    assert group_manager.is_game_active(group_id), "Game should be active after start"
    
    # Play through rounds
    for i in range(3):
        print(f"Round {script.current_round_index}: game active = {group_manager.is_game_active(group_id)}")
        assert group_manager.is_game_active(group_id), f"Game should be active during round {i}"
        
        # Advance round - return True if more rounds, False if finished
        has_more_rounds = script.step()
        if not has_more_rounds:
            print("Script indicates game is finished")
            # Simulate what /next_round does: mark game as ended
            script.script = None  # Clear script
            group_manager.mark_game_ended(group_id)
            break
    
    # After game ends
    print(f"After game ends - game active: {group_manager.is_game_active(group_id)}")
    assert not group_manager.is_game_active(group_id), "Game should be inactive after ending"
    
    print("✅ Game should remain inactive until new game starts")
    
    # Verify it stays inactive even with multiple polls
    for i in range(5):
        print(f"Poll {i+1}: game active = {group_manager.is_game_active(group_id)}")
        assert not group_manager.is_game_active(group_id), f"Game should stay inactive on poll {i+1}"
    
    # Start a new game to verify state is properly reset
    new_script = MockScript(2)
    group_manager.start_new_game(group_id, new_script)
    print(f"After starting new game - game active: {group_manager.is_game_active(group_id)}")
    assert group_manager.is_game_active(group_id), "Game should be active after starting new game"
    
    print("✅ All tests passed!")

if __name__ == "__main__":
    test_game_end_workflow()
