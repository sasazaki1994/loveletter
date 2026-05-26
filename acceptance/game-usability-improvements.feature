Feature: Game usability improvements

Scenario: First-time user understands how to start the game
  Given the user opens the game page
  Then the page should show the game objective
  And the page should show the basic rules
  And the page should show how to start the game

Scenario: Player can understand the current game state
  Given the game has started
  Then the page should show the current score or progress
  And the page should show remaining turns, time, or resources when applicable
  And the page should show the next available action

Scenario: Player receives clear feedback after an action
  Given the game has started
  When the player performs a valid action
  Then the game should update the state
  And the page should show feedback explaining the result

Scenario: Player can retry after game over
  Given the game has ended
  Then the page should show the result
  And the page should show why the result happened
  And the player should be able to restart the game

Scenario: Rapid clicks should not corrupt game state
  Given the game has started
  When the player clicks an action repeatedly
  Then the game state should remain valid
  And duplicate execution should be prevented where necessary

Scenario: Player perspective requires valid player token
  Given the game has started
  When a client requests state or stream with another player's id without a valid token
  Then the API should return unauthorized
  And hidden hand information should never be exposed

Scenario: Action authorization rejects inconsistent room/game/player combinations
  Given the game has started
  When a client posts play_card with mismatched roomId, gameId, or playerId
  Then the API should return success false without mutating game state
  And card effects, hand updates, and action or log inserts should not happen
