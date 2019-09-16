import { IBoard, getROMBoards, getCurrentBoard } from "../boards";
import { ValidationLevel, Game, BoardType } from "../types";
import { romhandler } from "../romhandler";
import { getValidationRules as getValidationRulesForMP1 } from "./validation.MP1";
import {
  getValidationRules as getValidationRulesForMP2,
  getValidationRulesForBoard as getBoardValidationRulesForMP2
} from "./validation.MP2";
import { getValidationRules as getValidationRulesForMP3 } from "./validation.MP3";
import { get, $setting } from "../views/settings";
import { getRule, IValidationRule } from "./validationrules";
import { getBoardInfos } from "../adapter/boardinfo";
import { IBoardInfo } from "../adapter/boardinfobase";

function _overwriteAvailable(boardInfo: IBoardInfo) {
  if (boardInfo.canOverwrite)
    return true;
  return false;
}

function _dontShowInUI(romBoard: IBoard, boardType: BoardType) {
  if (typeof boardType !== "string") {
    // Because default is normal
    return romBoard.type === BoardType.DUEL;
  }
  return romBoard.type !== boardType;
}

/**
 * Returns validation rules that apply for a specific game,
 * regardless of the ROM board being overwritten.
 */
function _getRulesForGame(gameID: Game): IValidationRule[] {
  let rules = [
    getRule("HASSTART"),
    getRule("GAMEVERSION"),
    getRule("DEADEND"),
    getRule("TOOMANYSPACES"),
    getRule("UNRECOGNIZEDEVENTS"),
    getRule("UNSUPPORTEDEVENTS"),
    getRule("CUSTOMEVENTFAIL"),
    getRule("CUSTOMEVENTBADPARAMS"),
    getRule("TOOMANYPATHOPTIONS"),
    getRule("CHARACTERSONPATH"),
    getRule("SPLITATNONINVISIBLESPACE"),
  ];

  switch (gameID) {
    case Game.MP1_USA:
    case Game.MP1_JPN:
      rules = rules.concat(getValidationRulesForMP1(gameID));
      break;
    case Game.MP2_USA:
    case Game.MP2_JPN:
      rules = rules.concat(getValidationRulesForMP2(gameID));
      break;
    case Game.MP3_USA:
    case Game.MP3_JPN:
      rules = rules.concat(getValidationRulesForMP3(gameID));
      break;
  }

  return rules;
}

/** Returns any validation rules specific to a particular game + board. */
function _getRulesForBoard(gameID: Game, boardIndex: number): IValidationRule[] {
  let rules: IValidationRule[] = [];

  switch (gameID) {
    case Game.MP2_USA:
    case Game.MP2_JPN:
      rules = rules.concat(getBoardValidationRulesForMP2(gameID, boardIndex));
      break;
  }

  return rules;
}

export interface IValidationResult {
  name?: string;
  unavailable?: boolean;
  forcedDisabled?: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCurrentBoardForOverwrite(): IValidationResult[] | null {
  let gameID = romhandler.getROMGame()!;
  if (!gameID)
    return null;

  let results: IValidationResult[] = [];
  let romBoards = getROMBoards();
  let currentBoard = getCurrentBoard();
  const skipValidation = get($setting.uiSkipValidation);

  // Evaluate rules common to all boards.
  let gameLevelErrors: string[] = [];
  let gameLevelWarnings: string[] = [];
  if (!skipValidation) {
    _getRulesForGame(gameID).forEach(rule => {
      const failureResult = rule.fails(currentBoard);
      if (failureResult) {
        if (rule.level === ValidationLevel.ERROR)
          gameLevelErrors.push(failureResult);
        else if (rule.level === ValidationLevel.WARNING)
          gameLevelWarnings.push(failureResult);
      }
    });
  }
  results.push({
    errors: gameLevelErrors,
    warnings: gameLevelWarnings,
  });

  const forcedDisabled = !skipValidation && gameLevelErrors.length > 0;

  // Evaluate any rules specific to certain ROM board targets.
  // As we switch to common overlays, these cases are dwindling.
  const boardInfos = getBoardInfos(gameID);
  romBoards.forEach((board, boardIndex) => {
    if (_dontShowInUI(board, currentBoard.type))
      return;

    const boardInfo = boardInfos[boardIndex];
    let unavailable = !_overwriteAvailable(boardInfo);

    let boardLevelErrors: string[] = [];
    let boardLevelWarnings: string[] = [];
    if (!unavailable && !get($setting.uiSkipValidation)) {
      let rules = _getRulesForBoard(gameID, boardIndex);
      rules.forEach(rule => {
        let failureResult = rule.fails(currentBoard);
        if (failureResult) {
          if (rule.level === ValidationLevel.ERROR)
            boardLevelErrors.push(failureResult);
          else if (rule.level === ValidationLevel.WARNING)
            boardLevelWarnings.push(failureResult);
        }
      });
    }

    results.push({
      name: board.name,
      unavailable,
      forcedDisabled,
      errors: boardLevelErrors,
      warnings: boardLevelWarnings,
    });
  });

  return results;
}
